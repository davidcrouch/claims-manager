'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  onTranscript: (text: string) => void;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  interimTranscript: string;
  error: string | null;
  toggle: () => void;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition({
  lang = 'en-AU',
  continuous = true,
  onTranscript,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const interimTranscriptRef = useRef('');

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const commitInterim = useCallback(() => {
    const pending = interimTranscriptRef.current.trim();
    if (!pending) return;
    onTranscriptRef.current(pending);
    interimTranscriptRef.current = '';
    setInterimTranscript('');
  }, []);

  const createRecognition = useCallback(() => {
    if (!isSupported) return null;

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();

    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          onTranscriptRef.current(result[0].transcript);
          interimTranscriptRef.current = '';
          setInterimTranscript('');
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) {
        interimTranscriptRef.current = interim;
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // If the browser never finalized the last utterance, commit interim text.
      commitInterim();
    };

    return recognition;
  }, [isSupported, lang, continuous, commitInterim]);

  const start = useCallback(() => {
    if (!isSupported) return;
    setError(null);

    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start speech recognition');
    }
  }, [isSupported, createRecognition]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    // Leave interim for onend / a final onresult so we don't drop or double-commit.
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    interimTranscript,
    error,
    toggle,
    start,
    stop,
  };
}
