// pages/index.js
import {
  Container,
  Flex,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Button,
  VStack,
  HStack,
  Text,
  useToast,
  Spinner,
  Grid,
  Box,
  Switch,
  FormHelperText,
} from "@chakra-ui/react";
import { useState, useRef, useEffect } from "react";
import { saveAs } from "file-saver"; // You will need to install file-saver: npm install file-saver

export default function Home() {
  const [apiUrlInput, setApiUrl] = useState("http://localhost:8000");
  const [streaming, setStreaming] = useState(true);
  const [inputText, setInputText] = useState("");
  const [voice, setVoice] = useState("andrew");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [streamingProgress, setStreamingProgress] = useState(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const nextStartTimeRef = useRef(0);

  const longText = `Shanghai is a direct-administered municipality and the most populous urban area in China.
    The city is located on the southern estuary of the Yangtze River, with the Huangpu River flowing through it.
    With a population of over 24 million as of 2019, it is the most populous city proper in the world.
    Shanghai is a global center for finance, innovation and transportation, and the Port of Shanghai is the world's busiest container port.
    Originally a fishing village and market town, Shanghai grew in importance in the 19th century due to its favorable port location and as one of the cities opened to foreign trade by the Treaty of Nanking.
    The city flourished as a center of commerce between East and West, and became a multinational hub of finance and business by the 1930s.
  `

  const alice = `In THAT direction, the Cat said, waving its right paw round, lives a Hatter:  and in THAT direction, waving the other paw, lives a March Hare.  Visit either you like:  they're both mad.

But I don't want to go among mad people, Alice remarked.

 Oh, you can't help that, said the Cat:  we're all mad here.
I'm mad.  You're mad.

How do you know I'm mad? said Alice.

You must be, said the Cat, or you wouldn't have come here.
`
  useEffect(() => {
    // Clean up the URL object when the component is unmounted or audioUrl changes
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const toast = useToast();

  const handleDownload = () => {
    saveAs(audioUrl, "speech.wav"); // This will save the file as "speech.mp3"
  };

  // Using OpenAI SDK via API route
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAudioUrl(null);
    setStreamingProgress(null);

    try {
      // Call our Next.js API route
      const response = await fetch('/api/openai-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiUrl: apiUrlInput,
          apiKey: '', // Your custom API might not need this
          input: inputText,
          voice: voice,
          model: 'tts-1',
          streaming: streaming,
          responseFormat: streaming ? 'pcm' : 'wav',
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const error = await response.json();
          errorMessage = error.details || error.error || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }

      // Handle streaming PCM response
      if (streaming) {
        // Initialize Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;
        nextStartTimeRef.current = audioContext.currentTime;

        const sampleRate = 22050; // Match your server's sample rate
        const numChannels = 1; // Mono audio

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const audioChunks = [];
        let chunkCount = 0;
        let pendingBytes = new Uint8Array(0); // Buffer for incomplete samples
        let buffer = ''; // Buffer for incomplete SSE messages

        // Function to convert PCM int16 to float32
        const pcmToFloat32 = (int16Array) => {
          const float32 = new Float32Array(int16Array.length);
          for (let i = 0; i < int16Array.length; i++) {
            float32[i] = int16Array[i] / 32768.0; // Normalize to -1.0 to 1.0
          }
          return float32;
        };

        // Function to play an audio buffer
        const playAudioChunk = (pcmData) => {
          if (pcmData.length === 0) return;

          // Convert bytes to Int16Array (PCM is 16-bit)
          const int16Array = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.length / 2);
          const float32Data = pcmToFloat32(int16Array);

          // Create AudioBuffer
          const audioBuffer = audioContext.createBuffer(numChannels, float32Data.length, sampleRate);
          audioBuffer.getChannelData(0).set(float32Data);

          // Create source and play
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);

          // Schedule to play after the previous chunk
          const startTime = Math.max(audioContext.currentTime, nextStartTimeRef.current);
          source.start(startTime);
          nextStartTimeRef.current = startTime + audioBuffer.duration;

          console.log(`Playing chunk ${chunkCount}, duration: ${audioBuffer.duration.toFixed(2)}s`);
        };

        // Read SSE stream chunks
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Process any remaining bytes
            if (pendingBytes.length >= 2) {
              const alignedLength = Math.floor(pendingBytes.length / 2) * 2;
              const finalChunk = pendingBytes.slice(0, alignedLength);
              audioChunks.push(finalChunk);
              playAudioChunk(finalChunk);
            }
            break;
          }

          // Decode the chunk as text (SSE format)
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages (separated by \n\n)
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || ''; // Keep incomplete message in buffer

          for (const message of messages) {
            if (!message.trim()) continue;

            // Parse SSE event
            const lines = message.split('\n');
            let eventData = null;

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  eventData = JSON.parse(line.substring(6));
                } catch (e) {
                  console.error('Failed to parse SSE data:', e);
                }
              }
            }

            // Extract base64 audio data
            if (eventData && eventData.type === 'speech.audio.delta' && eventData.audio) {
              // Decode base64 to binary
              const binaryString = atob(eventData.audio);
              const pcmData = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                pcmData[i] = binaryString.charCodeAt(i);
              }

              // Combine with pending bytes
              const combined = new Uint8Array(pendingBytes.length + pcmData.length);
              combined.set(pendingBytes, 0);
              combined.set(pcmData, pendingBytes.length);

              // Calculate how many complete 16-bit samples we have
              const alignedLength = Math.floor(combined.length / 2) * 2;
              const completeChunk = combined.slice(0, alignedLength);
              pendingBytes = combined.slice(alignedLength);

              if (completeChunk.length > 0) {
                console.log(`Chunk ${chunkCount + 1} received, size:`, completeChunk.length);
                audioChunks.push(completeChunk);
                chunkCount++;
                setStreamingProgress(chunkCount);

                // Play the chunk immediately
                playAudioChunk(completeChunk);
              }
            }
          }
        }

        // Create WAV file for download
        console.log('Creating WAV from', audioChunks.length, 'chunks');
        const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const concatenated = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of audioChunks) {
          concatenated.set(chunk, offset);
          offset += chunk.length;
        }

        // Create WAV blob
        const createWavBlob = (pcmData) => {
          const bytesPerSample = 2;
          const blockAlign = numChannels * bytesPerSample;
          const byteRate = sampleRate * blockAlign;
          const dataSize = pcmData.length;
          const buffer = new ArrayBuffer(44 + dataSize);
          const view = new DataView(buffer);

          const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
              view.setUint8(offset + i, string.charCodeAt(i));
            }
          };

          writeString(0, 'RIFF');
          view.setUint32(4, 36 + dataSize, true);
          writeString(8, 'WAVE');
          writeString(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, numChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, byteRate, true);
          view.setUint16(32, blockAlign, true);
          view.setUint16(34, 16, true);
          writeString(36, 'data');
          view.setUint32(40, dataSize, true);
          new Uint8Array(buffer, 44).set(pcmData);

          return new Blob([buffer], { type: 'audio/wav' });
        };

        const blob = createWavBlob(concatenated);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      } else {
        // Non-streaming: just get the blob (WAV format)
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "An error occurred",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.value.length <= 4096) {
      setInputText(e.target.value);
    }
  };

  const handleStreamToggle = () => {
    setStreaming(!streaming);
  };

  return (
    <Container bg={"gray.100"} maxW="container">
        <Flex
          direction="column"
          align="center"
          justify="center"
          minH="100vh"
          w="full"
        >
          <Box
            bg="white" // Assuming the card is white
            borderRadius="lg" // Rounded corners
            boxShadow="lg" // Shadow effect
            p={6} // Padding inside the card
            w="full" // Full width of the parent
            maxW="md" // Maximum width
          >
            <VStack
              spacing={6}
              as="form"
              onSubmit={handleSubmit}
              width="full"
              maxW="md"
            >
              <Box
                bg="black"
                w="100%"
                p={5}
                borderTopRadius="md"
                boxShadow="lg"
              >
                <Heading textAlign="center" color="white">
                  Open-Audio
                </Heading>
                <Text fontSize="xs" color="gray.100" textAlign="center" mt={2}>
                  Powered by KaniTTS{" "}
                </Text>
                <Text
                  fontSize="xs"
                  color="gray.100"
                  textAlign="center"
                  mt={2}
                  fontWeight={"700"}
                >
                  <a
                    href="https://github.com/nineninesix-ai/open-audio"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "gray.100" }}
                  >
                    View on GitHub
                  </a>
                </Text>
              </Box>
              <Grid
                templateColumns={{ md: "4fr 1fr" }} // 80-20 ratio
                gap={4}
                width="full"
              >
                <FormControl isRequired>
                  <FormLabel htmlFor="api-key">API Url</FormLabel>
                  <Input
                    id="api-key"
                    placeholder="Enter your API url"
                    type="url"
                    value={apiUrlInput}
                    onChange={(e) => setApiUrl(e.target.value)}
                    variant="outline"
                    borderColor="black"
                  />
                </FormControl>

                <FormControl>
                  <VStack align="start" spacing={0}>
                    <FormLabel htmlFor="streaming">Streaming</FormLabel>
                    <HStack align="center" h="100%" mx="0" mt="2">
                      <Switch
                        id="streaming"
                        colorScheme="blackAlpha"
                        isChecked={streaming}
                        onChange={handleStreamToggle}
                        size="md"
                      />
                      <FormHelperText textAlign="center" mt={"-1"}>
                        {streaming ? "On" : "Off"}
                      </FormHelperText>
                    </HStack>
                  </VStack>
                </FormControl>
              </Grid>

              <FormControl isRequired>
                <Textarea
                  id="input-text"
                  placeholder="Enter the text you want to convert to speech"
                  value={inputText}
                  onChange={handleInputChange}
                  resize="vertical"
                  maxLength={4096}
                  borderColor="black"
                />
                
              </FormControl>

              <Box width="full">
                <HStack spacing={2} flexWrap="wrap" mb={2}>
                  <Text fontSize="xs" color="gray.600">Examples:</Text>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setInputText("Hello! Welcome to Open Audio. This is a text-to-speech demo powered by Kani TTS.")}
                  >
                    Welcome
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setInputText(longText)}
                  >
                    Long text
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setInputText(alice)}
                  >
                    Complex text
                  </Button>
                </HStack>
                <Box textAlign="right" fontSize="sm">
                  {inputText.length} / 2048
                </Box>
              </Box>

              <HStack width="full" justifyContent="space-between">
                <FormControl isRequired width="45%">
                  <Select
                    id="voice"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    variant="outline"
                    placeholder="Select voice"
                    borderColor="black"
                    focusBorderColor="black"
                    colorScheme="blackAlpha"
                    _hover={{ borderColor: "gray.400" }} // Optional: style for hover state
                  >
                    {/* List of supported voices */}
                    <option value="andrew">Andrew</option>
                    <option value="katie">Katie</option>
                  </Select>
                </FormControl>

                <Button
                bg="black"
                color={"white"}
                colorScheme="black"
                borderColor="black"
                type="submit"
                isLoading={isSubmitting}
                loadingText="Generating..."
              >
                Create Speech
              </Button>
              </HStack>

              {isSubmitting && (
                <VStack spacing={2}>
                  <Spinner
                    thickness="4px"
                    speed="0.65s"
                    emptyColor="gray.200"
                    color="black"
                    size="md"
                  />
                  {streaming && streamingProgress !== null && (
                    <Text fontSize="sm" color="gray.600">
                      Streaming chunks: {streamingProgress}
                    </Text>
                  )}
                </VStack>
              )}
              {audioUrl && (
                <>
                  <audio ref={audioRef} controls src={audioUrl}>
                    Your browser does not support the audio element.
                  </audio>
                  <Button onClick={handleDownload}>Download WAV</Button>
                </>
              )}
            </VStack>
          </Box>
        </Flex>
    </Container>
  );
}
