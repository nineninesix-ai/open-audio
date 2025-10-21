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

  const [stream_format, setStreamFormat] = useState("sse");
  const [inputText, setInputText] = useState("");
  const [voice, setVoice] = useState("random");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [streamingProgress, setStreamingProgress] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const nextStartTimeRef = useRef(0);

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

  // Assuming `openai.audio.speech.create` returns a stream or binary data
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAudioUrl(null);
    setStreamingProgress(null);
    setUsageStats(null);
    try {
      // Define the request headers
      const headers = new Headers();
      const apiUrl = apiUrlInput;
      headers.append("Content-Type", "application/json");

      // Define the request body
      const body = JSON.stringify({
        input: inputText,
        voice: voice,
        stream_format: stream_format,
      });

      // Make the fetch request to the OpenAI API
      const response = await fetch(`${apiUrl}/v1/audio/speech`, {
        method: "POST",
        headers: headers,
        body: body,
      });


      console.log(response);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle response based on stream_format
      if (stream_format === "sse") {
        // SSE streaming mode - play PCM audio with Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;
        nextStartTimeRef.current = audioContext.currentTime;

        const sampleRate = 22050; // Match your server's sample rate
        const numChannels = 1; // Mono audio

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const audioChunks = [];
        let buffer = "";
        let chunkCount = 0;

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
          // Convert bytes to Int16Array (PCM is 16-bit)
          const int16Array = new Int16Array(pcmData.buffer);
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6); // Remove "data: " prefix
              try {
                const event = JSON.parse(jsonStr);

                if (event.type === "speech.audio.delta") {
                  // Decode base64 PCM chunk
                  const binaryString = atob(event.audio);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }

                  console.log(`Chunk ${chunkCount + 1} received, size:`, bytes.length);
                  audioChunks.push(bytes);
                  chunkCount++;
                  setStreamingProgress(chunkCount);

                  // Play the chunk immediately
                  playAudioChunk(bytes);
                } else if (event.type === "speech.audio.done") {
                  // Store usage stats
                  console.log('Stream complete, usage:', event.usage);
                  setUsageStats(event.usage);
                }
              } catch (e) {
                console.error("Failed to parse SSE event:", e);
              }
            }
          }
        }

        // Create WAV file for download (optional)
        // We still create a blob URL for the audio element display/download
        console.log('Creating audio from', audioChunks.length, 'chunks');
        const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const concatenated = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of audioChunks) {
          concatenated.set(chunk, offset);
          offset += chunk.length;
        }

        // Create a simple WAV blob for download
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
        // Regular audio format (non-streaming)
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        setAudioUrl(audioUrl);
        setUsageStats(null);
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
    setStreamFormat(stream_format === "sse" ? "audio" : "sse");
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
                    <FormLabel htmlFor="stream_format">Audio/SSE</FormLabel>
                    <HStack align="center" h="100%" mx="0" mt="2">
                      <Switch
                        id="stream_format"
                        colorScheme="blackAlpha"
                        isChecked={stream_format === "sse"}
                        onChange={handleStreamToggle}
                        size="md" // Optional: if you want a larger switch
                      />
                      <FormHelperText textAlign="center" mt={"-1"}>
                        {stream_format === "sse" ? "SSE" : "Audio"}
                      </FormHelperText>
                    </HStack>
                  </VStack>
                </FormControl>
              </Grid>

              <FormControl isRequired>
                <FormLabel htmlFor="input-text">Input Text</FormLabel>
                <Textarea
                  id="input-text"
                  placeholder="Enter the text you want to convert to speech"
                  value={inputText}
                  onChange={handleInputChange}
                  resize="vertical"
                  maxLength={4096}
                  borderColor="black"
                />
                <Box textAlign="right" fontSize="sm">
                  {inputText.length} / 2048
                </Box>
              </FormControl>

              <HStack width="full" justifyContent="space-between">
                <FormControl isRequired width="45%">
                  <FormLabel htmlFor="voice">Voice</FormLabel>
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
                    <option value="random">Random</option>
                    <option value="alloy">Alloy</option>
                    <option value="echo">Echo</option>
                    <option value="fable">Fable</option>
                    <option value="onyx">Onyx</option>
                    <option value="nova">Nova</option>
                    <option value="shimmer">Shimmer</option>
                  </Select>
                </FormControl>
              </HStack>

              <Button
                size="lg"
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

              {isSubmitting && (
                <VStack spacing={2}>
                  <Spinner
                    thickness="4px"
                    speed="0.65s"
                    emptyColor="gray.200"
                    color="black"
                    size="md"
                  />
                  {stream_format === "sse" && streamingProgress !== null && (
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
                  {usageStats && (
                    <Box
                      p={3}
                      bg="gray.50"
                      borderRadius="md"
                      width="full"
                      fontSize="sm"
                    >
                      <Text fontWeight="bold" mb={1}>
                        Usage Statistics:
                      </Text>
                      <Text>Input tokens: {usageStats.input_tokens}</Text>
                      <Text>Output tokens: {usageStats.output_tokens}</Text>
                      <Text>Total tokens: {usageStats.total_tokens}</Text>
                    </Box>
                  )}
                </>
              )}
            </VStack>
          </Box>
        </Flex>
    </Container>
  );
}
