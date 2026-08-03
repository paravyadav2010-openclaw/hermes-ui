import { useCallback, useEffect, useRef, useState } from 'react'
import { registerPlugin } from '@capacitor/core'

import { useI18n } from '@/i18n'
import { notify, notifyError } from '@/store/notifications'

import type { VoiceActivityState, VoiceStatus } from '../types'

import { useMicRecorder } from './use-mic-recorder'

interface VoiceRecorderOptions {
  maxRecordingSeconds: number
  onTranscribeAudio?: (audio: Blob) => Promise<string>
  focusInput: () => void
  onTranscript: (text: string) => void
  onInterim?: (text: string) => void
  /** Live word-by-word streaming: append each chunk transcript with a space. */
  onStreamingTranscript?: (text: string) => void
  /** Read the current composer draft (hermex-style baseDraft capture). */
  getDraftText?: () => string
  /** Replace the whole draft on every partial (native dictation live typing). */
  onLiveDraft?: (text: string) => void
}

// Web Speech API recognition handle. iOS Safari/WKWebView expose it as
// webkitSpeechRecognition; Chrome/Firefox ship the unprefixed form.
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionWindow {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

const SPEECH_TIMEOUT_MS = 15_000

function speechRecognitionAvailable(): boolean {
  const w = window as unknown as SpeechRecognitionWindow

  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}

export function useVoiceRecorder({
  maxRecordingSeconds,
  onTranscribeAudio,
  focusInput,
  onTranscript,
  onInterim,
  onStreamingTranscript,
  getDraftText,
  onLiveDraft
}: VoiceRecorderOptions) {
  const { t } = useI18n()
  const voiceCopy = t.notifications.voice
  const { handle, level, recording } = useMicRecorder(voiceCopy)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [interimText, setInterimText] = useState('')
  const startedAtRef = useRef(0)
  const intervalRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const speechTimeoutRef = useRef<number | null>(null)
  const clearSpeechTimeoutRef = useRef<number | null>(null)
  const nativeSpeechFallbackTimerRef = useRef<number | null>(null)
  const streamingRef = useRef(false)
  const streamingChunkInFlightRef = useRef(false)
  const nativeSpeechRef = useRef(false)
  const nativeSpeechListenersRef = useRef<Array<() => void>>([])
  // iOS may start the next speech task before its external composer store has
  // published the final partial. Keep the committed native draft locally so a
  // pause and resume never begins from an empty string.
  const nativeDraftRef = useRef('')

  const clearTimers = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (speechTimeoutRef.current) {
      window.clearTimeout(speechTimeoutRef.current)
      speechTimeoutRef.current = null
    }

    if (clearSpeechTimeoutRef.current) {
      window.clearTimeout(clearSpeechTimeoutRef.current)
      clearSpeechTimeoutRef.current = null
    }

    if (nativeSpeechFallbackTimerRef.current) {
      window.clearTimeout(nativeSpeechFallbackTimerRef.current)
      nativeSpeechFallbackTimerRef.current = null
    }
  }

  useEffect(() => () => clearTimers(), [])

  // Live dictation (PWA 9400 parity, 2026-08-03): when the Web Speech API is
  // available, the mic button drives SpeechRecognition directly with
  // interimResults=true so words stream into the composer as they're heard —
  // no record-then-transcribe round trip. Falls back to MediaRecorder →
  // gateway transcription when speech recognition is unavailable (and to
  // keyboard focus when no mic API exists at all, e.g. plain HTTP).
  const stopSpeechDictation = useCallback(() => {
    if (speechTimeoutRef.current !== null) {
      window.clearTimeout(speechTimeoutRef.current)
      speechTimeoutRef.current = null
    }

    if (clearSpeechTimeoutRef.current !== null) {
      window.clearTimeout(clearSpeechTimeoutRef.current)
      clearSpeechTimeoutRef.current = null
    }

    try {
      recognitionRef.current?.abort()
    } catch {
      // already stopped
    }

    recognitionRef.current = null
    setInterimText('')
    setVoiceStatus('idle')
  }, [])

  const stop = useCallback(async () => {
    clearTimers()

    // Streaming mode: every timeslice chunk was already transcribed and
    // appended live — the final blob must NOT be re-transcribed (it would
    // duplicate the words already in the composer).
    const wasStreaming = streamingRef.current
    streamingRef.current = false

    const result = await handle.stop()

    if (!result) {
      setVoiceStatus('idle')

      return
    }

    if (wasStreaming) {
      setVoiceStatus('idle')
      focusInput()

      return
    }

    if (!onTranscribeAudio) {
      setVoiceStatus('idle')

      return
    }

    setVoiceStatus('transcribing')
    setInterimText('')

    try {
      const transcript = (await onTranscribeAudio(result.audio)).trim()

      if (!transcript) {
        notify({ kind: 'warning', title: voiceCopy.noSpeechDetected, message: voiceCopy.tryRecordingAgain })
      } else {
        onTranscript(transcript)
      }
    } catch (error) {
      notifyError(error, voiceCopy.transcriptionFailed)
    } finally {
      setVoiceStatus('idle')
      focusInput()
    }
  }, [clearTimers, focusInput, handle, onTranscribeAudio, onTranscript, voiceCopy])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      stopSpeechDictation()

      return
    }

    void stop()
  }, [stop, stopSpeechDictation])

  // Live streaming dictation (WKWebView path, 2026-08-03): MediaRecorder runs
  // with a timeslice; each chunk is transcribed as it arrives and the words
  // stream into the composer while the user is still talking (PWA-9400-style
  // "types as you speak" without SpeechRecognition, which WKWebView lacks).
  const startStreaming = useCallback(async () => {
    if (!onTranscribeAudio || !onStreamingTranscript) {
      return
    }

    streamingRef.current = true
    streamingChunkInFlightRef.current = false

    try {
      await handle.start({
        timesliceMs: 3000,
        onChunk: async chunk => {
          if (streamingChunkInFlightRef.current) {
            return
          }

          streamingChunkInFlightRef.current = true

          try {
            const text = (await onTranscribeAudio(chunk)).trim()

            if (text) {
              onStreamingTranscript(text)
              setInterimText(text)
            }
          } catch {
            // A failed chunk shouldn't kill the whole dictation — the words
            // may still come through on the next slice.
          } finally {
            streamingChunkInFlightRef.current = false
          }
        },
        onError: error => notifyError(error, voiceCopy.recordingFailed)
      })
      startedAtRef.current = Date.now()
      setElapsedSeconds(0)
      setVoiceStatus('recording')
      intervalRef.current = window.setInterval(() => setElapsedSeconds((Date.now() - startedAtRef.current) / 1000), 250)
      const cap = Math.max(1, Math.min(Math.trunc(maxRecordingSeconds), 600))
      timeoutRef.current = window.setTimeout(() => void stopRecording(), cap * 1000)
    } catch (error) {
      streamingRef.current = false
      setVoiceStatus('idle')
      notifyError(error, voiceCopy.recordingFailed)
    }
  }, [handle, maxRecordingSeconds, notify, onTranscribeAudio, onStreamingTranscript, stopRecording, voiceCopy])

  const start = useCallback(async () => {
    if (!onTranscribeAudio) {
      notify({ kind: 'warning', title: voiceCopy.unavailable, message: voiceCopy.transcriptionUnavailable })

      return
    }

    try {
      await handle.start({ onError: error => notifyError(error, voiceCopy.recordingFailed) })
      startedAtRef.current = Date.now()
      setElapsedSeconds(0)
      setVoiceStatus('recording')
      intervalRef.current = window.setInterval(() => setElapsedSeconds((Date.now() - startedAtRef.current) / 1000), 250)
      const cap = Math.max(1, Math.min(Math.trunc(maxRecordingSeconds), 600))
      timeoutRef.current = window.setTimeout(() => void stopRecording(), cap * 1000)
    } catch (error) {
      setVoiceStatus('idle')
      notifyError(error, voiceCopy.recordingFailed)
    }
  }, [handle, maxRecordingSeconds, notify, onTranscribeAudio, stopRecording, voiceCopy])

  const startSpeechDictation = useCallback(() => {
    const w = window as unknown as SpeechRecognitionWindow
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition

    if (!Ctor) {
      return false
    }

    const recognition = new Ctor()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1

    const finish = (text: string) => {
      if (speechTimeoutRef.current !== null) {
        window.clearTimeout(speechTimeoutRef.current)
        speechTimeoutRef.current = null
      }

      if (clearSpeechTimeoutRef.current !== null) {
        window.clearTimeout(clearSpeechTimeoutRef.current)
        clearSpeechTimeoutRef.current = null
      }

      setInterimText(text || '')
      setVoiceStatus('idle')

      try {
        recognition.abort()
      } catch {
        // already done
      }

      recognitionRef.current = null

      if (text) {
        onTranscript(text)
      } else {
        notify({ kind: 'warning', title: voiceCopy.noSpeechDetected, message: voiceCopy.tryRecordingAgain })
      }

      focusInput()
    }

    recognition.onresult = event => {
      const result = event.results[event.results.length - 1]
      const transcript = (result?.[0]?.transcript ?? '').trim()

      if (result?.isFinal) {
        finish(transcript)
      } else {
        setInterimText(transcript)
        onInterim?.(transcript)

        // Safety net: if the engine never sends a final result (e.g. a long
        // pause), commit what we heard and stop.
        if (speechTimeoutRef.current !== null) {
          window.clearTimeout(speechTimeoutRef.current)
        }

        speechTimeoutRef.current = window.setTimeout(() => finish(transcript), 3_000)
      }
    }

    recognition.onerror = () => finish('')
    recognition.onend = () => {
      // If onresult fired, finish() already handled it; otherwise the engine
      // ended without a result (silence) — treat as no speech.
      if (recognitionRef.current === recognition) {
        finish('')
      }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setInterimText('')
      setVoiceStatus('dictating')
      clearSpeechTimeoutRef.current = window.setTimeout(() => {
        // Whole-dictation cap, mirroring the PWA's 15s timeout.
        finish('')
      }, SPEECH_TIMEOUT_MS)

      return true
    } catch {
      setVoiceStatus('idle')

      return false
    }
  }, [focusInput, notify, onInterim, onTranscript, voiceCopy])

  // Apple's on-device SFSpeechRecognizer via the native HermesSpeech plugin
  // (Capacitor). Same engine as the iOS keyboard dictation — live partials,
  // offline, no gateway round trip. The plugin emits `partial` (while
  // talking) and `final` (committed) events. Accessed the Capacitor way:
  // `window.Capacitor.Plugins` only contains plugins shipped in Capacitor's
  // default JS bundle. HermesSpeech is registered dynamically by the native
  // wrapper, so it must be registered through Capacitor's JS API first.
  interface HermesSpeechPlugin {
    start?: () => Promise<unknown>
    stop?: () => Promise<unknown>
    cancel?: () => Promise<unknown>
    isAvailable?: () => Promise<{ available?: boolean; authorized?: boolean }>
    addListener?: (event: string, fn: (data: { text?: string; message?: string }) => void) => Promise<{ remove: () => void }>
  }

  const getNativeSpeechPlugin = useCallback((): HermesSpeechPlugin | undefined => {
    const cap = (
      window as unknown as {
        Capacitor?: {
          isNativePlatform?: () => boolean
          getPlatform?: () => string
          registerPlugin?: (name: string, options?: unknown) => HermesSpeechPlugin
          Plugins?: Record<string, HermesSpeechPlugin>
        }
      }
    ).Capacitor

    if (!cap) {
      return undefined
    }

    if (cap.Plugins?.HermesSpeech) {
      return cap.Plugins.HermesSpeech
    }

    try {
      const plugin = registerPlugin<HermesSpeechPlugin>('HermesSpeech')
      if (cap.Plugins) {
        cap.Plugins.HermesSpeech = plugin
      }
      return plugin
    } catch {
      // The native bridge is unavailable (ordinary browser), not a dictation
      // failure. The caller will choose the web/recording fallback.
    }

    return undefined
  }, [])

  const stopNativeSpeech = useCallback(() => {
    if (nativeSpeechFallbackTimerRef.current !== null) {
      window.clearTimeout(nativeSpeechFallbackTimerRef.current)
      nativeSpeechFallbackTimerRef.current = null
    }

    nativeSpeechRef.current = false

    for (const off of nativeSpeechListenersRef.current) {
      off()
    }

    nativeSpeechListenersRef.current = []

    try {
      getNativeSpeechPlugin()?.stop?.()
    } catch {
      // best effort
    }

    setInterimText('')
    setVoiceStatus('idle')
  }, [getNativeSpeechPlugin])

  const startNativeSpeech = useCallback((): boolean => {
    const cap = (
      window as unknown as {
        Capacitor?: {
          isNativePlatform?: () => boolean
          getPlatform?: () => string
          Plugins?: Record<string, unknown>
        }
      }
    ).Capacitor

    const speech = getNativeSpeechPlugin()

    // Diagnostic surface: if speech bridge or plugin is missing, present top-center toast + UI interim error
    const diag = () => {
      const present = {
        capacitor: Boolean(cap),
        plugins: Boolean(cap?.Plugins),
        pluginKeys: cap?.Plugins ? Object.keys(cap.Plugins) : [],
        hermesSpeech: Boolean(speech),
        start: Boolean(speech?.start),
        platform: typeof cap?.isNativePlatform === 'function' ? String(cap.isNativePlatform()) : (cap?.getPlatform?.() ?? 'n/a')
      }

      notify({
        kind: 'error',
        placement: 'default',
        title: `Speech bridge: ${present.hermesSpeech && present.start ? 'plugin OK' : 'plugin MISSING'}`,
        message: JSON.stringify(present)
      })

      setInterimText(`Speech plugin missing (platform: ${present.platform})`)
      setVoiceStatus('dictating')
      window.setTimeout(() => {
        setInterimText('')
        setVoiceStatus('idle')
      }, 4000)
    }

    if (!speech?.start) {
      diag()

      return false
    }

    // Guarantee native speech state and inline visible Listening... UI BEFORE any plugin calls
    nativeSpeechRef.current = true
    setInterimText('Listening...')
    setVoiceStatus('dictating')

    // hermex-style baseDraft capture: the draft text at the moment dictation
    // starts becomes the prefix; every partial REPLACES the draft with
    // `baseDraft + transcript` so words type live into the composer.
    const visibleDraft = (getDraftText?.() ?? '').trim()
    const baseDraft = visibleDraft || nativeDraftRef.current
    nativeDraftRef.current = baseDraft
    // TEMP-INSTRUMENT (2026-08-04 finch:work, HANDOFF-2026-08-03.md:77-82):
    // overwrite relapse — log draft capture ordering so we can see WHICH
    // source is empty/stale when dictation starts. Remove after diagnosis.
    console.log(
      '[dict-dbg] startNativeSpeech capture:',
      JSON.stringify({
        visibleDraft,
        baseDraft,
        nativeDraftRef_before: baseDraft,
        draftRefNow: getDraftText?.() ?? '',
        status: 'dictating',
        at: new Date().toISOString()
      })
    )
    const compose = (transcript: string) => {
      const t = transcript.trim()

      if (!t) {
        return baseDraft
      }

      return baseDraft ? `${baseDraft} ${t}` : t
    }
    const replaceNativeDraft = (transcript: string) => {
      const next = compose(transcript)
      nativeDraftRef.current = next
      onLiveDraft?.(next)
    }

    const addNativeListener = (event: string, listener: (data: { text?: string; message?: string }) => void) => {
      try {
        const registration = speech.addListener?.(event, listener)
        if (!registration) {
          return
        }

        // Capacitor's generated proxy returns a Promise in a browser bundle,
        // while the native v7 bridge returns the handle immediately. Treat
        // both shapes identically; calling `.then` on the native handle was
        // crashing the WebView before speech.start() could run.
        void Promise.resolve(registration)
          .then(handle => {
            nativeSpeechListenersRef.current.push(() => {
              void handle.remove()
            })
          })
          .catch(() => {
            // Listener registration is best effort; start() reports the real
            // recognition error if the native plugin cannot run.
          })
      } catch {
        // Keep the button usable even if an optional listener is unavailable.
      }
    }

    addNativeListener('partial', data => {
        const text = (data?.text ?? '').trim()

        if (text) {
          if (nativeSpeechFallbackTimerRef.current !== null) {
            window.clearTimeout(nativeSpeechFallbackTimerRef.current)
            nativeSpeechFallbackTimerRef.current = null
          }
          setInterimText(text)
          onInterim?.(text)
          if (onLiveDraft) {
            // TEMP-INSTRUMENT (2026-08-04 finch:work): partial event ordering
            // — what text arrived, what we composed, what the live draft is.
            console.log(
              '[dict-dbg] partial event:',
              JSON.stringify({
                text,
                composed: (() => {
                  const t = text.trim()
                  return baseDraft ? `${baseDraft} ${t}` : t
                })(),
                nativeDraftRef_now: nativeDraftRef.current,
                visibleNow: getDraftText?.() ?? '',
                at: new Date().toISOString()
              })
            )
            replaceNativeDraft(text)
          }
        }
      })

    addNativeListener('error', data => {
        const errMsg = data?.message ?? 'Speech recognition failed'
        notify({
          kind: 'error',
          placement: 'default',
          title: voiceCopy.transcriptionFailed,
          message: errMsg
        })
        setInterimText(`Speech error: ${errMsg}`)
        stopNativeSpeech()
      })

    addNativeListener('final', data => {
        const text = (data?.text ?? '').trim()
        if (nativeSpeechFallbackTimerRef.current !== null) {
          window.clearTimeout(nativeSpeechFallbackTimerRef.current)
          nativeSpeechFallbackTimerRef.current = null
        }
        nativeSpeechRef.current = false

        for (const off of nativeSpeechListenersRef.current) {
          off()
        }

        nativeSpeechListenersRef.current = []
        setInterimText('')
        setVoiceStatus('idle')

        if (text) {
          // Live dictation already replaces the draft on every partial — the
          // final transcript is already typed in. Commit the final composed
          // draft once (replace, not append) to normalize trailing partials.
          if (onLiveDraft) {
            // TEMP-INSTRUMENT (2026-08-04 finch:work): final event ordering —
            // the committed text and the draft state at commit time.
            console.log(
              '[dict-dbg] final event:',
              JSON.stringify({
                text,
                composed: (() => {
                  const t = text.trim()
                  return baseDraft ? `${baseDraft} ${t}` : t
                })(),
                nativeDraftRef_before: nativeDraftRef.current,
                visibleNow: getDraftText?.() ?? '',
                at: new Date().toISOString()
              })
            )
            replaceNativeDraft(text)
          } else {
            onTranscript(text)
          }
        } else {
          notify({
            kind: 'warning',
            placement: 'default',
            title: voiceCopy.noSpeechDetected,
            message: voiceCopy.tryRecordingAgain
          })
        }

        focusInput()
      })

    // The plugin's start() can reject (e.g. on-device speech models still
    // downloading) — don't leave the UI stuck in 'dictating'. Fall back to
    // the gateway streaming path so the mic still works.
    Promise.resolve(speech.start())
      .then(() => {
        if (nativeSpeechRef.current) {
          setVoiceStatus('dictating')
        }
      })
      .catch(error => {
        if (!nativeSpeechRef.current) {
          return
        }

        const errMsg = error instanceof Error ? error.message : String(error)
        notify({
          kind: 'error',
          placement: 'default',
          title: 'Native speech start failed',
          message: errMsg
        })

        setInterimText(`Start failed: ${errMsg}`)
        nativeSpeechRef.current = false
        setVoiceStatus('idle')

        if (onTranscribeAudio && onStreamingTranscript) {
          void startStreaming()
        }
      })

    // A custom Capacitor plugin can accept the JS call yet never return a
    // native callback. Never strand the mic in that state: after six seconds
    // without a partial/final result, release it and use the working recorder
    // + gateway streaming path instead.
    nativeSpeechFallbackTimerRef.current = window.setTimeout(() => {
      if (!nativeSpeechRef.current) {
        return
      }

      nativeSpeechRef.current = false
      void speech.stop?.().catch(() => undefined)

      if (onTranscribeAudio && onStreamingTranscript) {
        setInterimText('Switching to live transcription…')
        setVoiceStatus('idle')
        void startStreaming()
        return
      }

      setInterimText('Native speech did not return audio')
      setVoiceStatus('idle')
    }, 6_000)

    return true
  }, [focusInput, getDraftText, getNativeSpeechPlugin, notify, onInterim, onLiveDraft, onStreamingTranscript, onTranscript, onTranscribeAudio, startStreaming, stopNativeSpeech, voiceCopy])

  const dictate = () => {
    // A real active recognizer is toggle-to-stop. A stale React status without
    // a live recognizer must be cleared and allowed to restart in this same
    // tap; previously it consumed one tap and looked like a dead mic.
    if (recognitionRef.current || nativeSpeechRef.current) {
      stopSpeechDictation()
      stopNativeSpeech()

      return
    }

    if (recording) {
      void stopRecording()

      return
    }

    if (voiceStatus !== 'idle') {
      stopSpeechDictation()
      stopNativeSpeech()
      setVoiceStatus('idle')
      setInterimText('')
    }

    // In the Capacitor wrapper (WKWebView) webkitSpeechRecognition exists but
    // dies instantly with no result and NO permission prompt — Apple only
    // supports the Web Speech API in Safari, not WKWebView. The PWA works
    // because it runs in Safari.
    const cap = (
      window as unknown as {
        Capacitor?: {
          isNativePlatform?: () => boolean
          getPlatform?: () => string
          Plugins?: Record<string, unknown>
        }
      }
    ).Capacitor

    // This wrapper loads a remote HTTPS page, so Capacitor can report "web"
    // even while its native bridge is present. Haptics proves the bridge is
    // active; use it to avoid WKWebView's dead webkitSpeechRecognition path.
    const inCapacitor = Boolean(
      cap?.isNativePlatform?.() ||
        cap?.getPlatform?.() === 'ios' ||
        cap?.getPlatform?.() === 'android' ||
        Boolean(cap?.Plugins?.Haptics)
    )

    if (!inCapacitor && startSpeechDictation()) {
      return
    }

    // Native wrapper: use Apple's SFSpeechRecognizer first so partial results
    // replace the composer draft as the user speaks. The recorder remains the
    // fallback only when the native bridge rejects or is unavailable.
    if (inCapacitor && startNativeSpeech()) {
      return
    }

    if (inCapacitor && onTranscribeAudio && onStreamingTranscript) {
      void startStreaming()

      return
    }

    // Fallback: record-then-transcribe via the gateway.
    if (onTranscribeAudio) {
      void start()

      return
    }

    // No mic API at all (plain HTTP) — just focus the keyboard.
    focusInput()
  }

  const voiceActivityState: VoiceActivityState = {
    elapsedSeconds,
    interimText,
    level,
    status: voiceStatus
  }

  return { dictate, voiceActivityState, voiceStatus }
}
