import { useCallback, useEffect, useRef, useState } from 'react'

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
  onStreamingTranscript
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
  const streamingRef = useRef(false)
  const streamingChunkInFlightRef = useRef(false)
  const nativeSpeechRef = useRef(false)
  const nativeSpeechListenersRef = useRef<Array<() => void>>([])

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
  // talking) and `final` (committed) events.
  const stopNativeSpeech = useCallback(() => {
    if (!nativeSpeechRef.current) {
      return
    }

    nativeSpeechRef.current = false

    for (const off of nativeSpeechListenersRef.current) {
      off()
    }

    nativeSpeechListenersRef.current = []

    try {
      void (window as unknown as { HermesSpeech?: { stop?: () => Promise<unknown> } }).HermesSpeech?.stop?.()
    } catch {
      // best effort
    }

    setInterimText('')
    setVoiceStatus('idle')
  }, [])

  const startNativeSpeech = useCallback((): boolean => {
    const speech = (window as unknown as { HermesSpeech?: { start?: () => Promise<unknown>; addListener?: (event: string, fn: (data: { text?: string }) => void) => Promise<{ remove: () => void }> } }).HermesSpeech

    if (!speech?.start) {
      return false
    }

    void speech
      .addListener?.('partial', data => {
        const text = (data?.text ?? '').trim()

        if (text) {
          setInterimText(text)
          onInterim?.(text)
        }
      })
      .then(handle => {
        nativeSpeechListenersRef.current.push(() => {
          void handle.remove()
        })
      })
      .catch(() => {
        // listener registration failed — nothing to clean up
      })

    void speech
      .addListener?.('final', data => {
        const text = (data?.text ?? '').trim()
        nativeSpeechRef.current = false

        for (const off of nativeSpeechListenersRef.current) {
          off()
        }

        nativeSpeechListenersRef.current = []
        setInterimText('')
        setVoiceStatus('idle')

        if (text) {
          onTranscript(text)
        } else {
          notify({ kind: 'warning', title: voiceCopy.noSpeechDetected, message: voiceCopy.tryRecordingAgain })
        }

        focusInput()
      })
      .catch(() => {
        // listener registration failed — stop cleanly below
        nativeSpeechRef.current = false
        setVoiceStatus('idle')
      })

    try {
      void speech.start()
      nativeSpeechRef.current = true
      setInterimText('')
      setVoiceStatus('dictating')

      return true
    } catch {
      nativeSpeechRef.current = false
      setVoiceStatus('idle')

      return false
    }
  }, [focusInput, notify, onInterim, onTranscript, voiceCopy])

  const dictate = () => {
    if (recognitionRef.current || voiceStatus === 'dictating' || nativeSpeechRef.current) {
      stopSpeechDictation()
      stopNativeSpeech()

      return
    }

    if (recording) {
      void stopRecording()

      return
    }

    if (voiceStatus !== 'idle') {
      return
    }

    // In the Capacitor wrapper (WKWebView) webkitSpeechRecognition exists but
    // dies instantly with no result and NO permission prompt — Apple only
    // supports the Web Speech API in Safari, not WKWebView. The PWA works
    // because it runs in Safari.
    const inCapacitor = Boolean(
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
    )

    if (!inCapacitor && startSpeechDictation()) {
      return
    }

    // Native app: prefer Apple's on-device SFSpeechRecognizer (HermesSpeech
    // plugin — the same engine as the iOS keyboard dictation: free, offline,
    // live partials). User: 'use iphone default dictation, it is pretty good
    // in iOS 27'.
    if (inCapacitor && startNativeSpeech()) {
      return
    }

    // Fallback: stream chunks to the gateway while recording so words
    // appear in the composer as you speak.
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
