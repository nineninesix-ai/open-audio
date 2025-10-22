# Open-Audio TTS

<div style='{"display": "flex"}'>

[![](https://dcbadge.limes.pink/api/server/https://discord.gg/NzP3rjB4SB?style=flat)](https://discord.gg/NzP3rjB4SB)  [![Deploy with Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)](https://vercel.com/new/clone?repository-url=https://github.com/nineninesix-ai/open-audio)

</div>

Open-Audio TTS is a web application that allows users to convert text into natural-sounding speech. Powered by KaniTTS text-to-speech models, this tool offers an intuitive user interface built with Chakra UI, providing a seamless experience for generating and downloading speech audio files.

## Features

- **Text-to-Speech**: Convert any text into speech.
- **Customizable Voices**: Choose from a variety of voices to find the one that best suits your needs.
- **BYO**: Bring your Own (BYO) API url.
- **Downloadable Audio**: Easily download the generated speech as an MP3 file directly from the browser.
- **User-Friendly Interface**: Built with responsiveness in mind, offering a comfortable experience across different devices.


## Installation

To set up the project locally, follow these steps:

1. Clone the repository to your local machine.
2. Navigate to the project directory.
3. Install dependencies with `npm install`.
4. Start the development server with `npm run dev`.
5. Open `http://localhost:3000` to view it in the browser.


## Usage

To use Open-Audio TTS, simply:

1. Enter your server API url in the provided field. (The server app is available at [https://github.com/nineninesix-ai/kanitts-vllm](https://github.com/nineninesix-ai/kanitts-vllm))
2. Type or paste the text you wish to convert into the 'Input Text' field.
3. Select the voice.
4. Click on 'Create Speech' to generate the audio.
5. Once the audio is generated, use the controls to play it or click 'Download WAV' to save it.

# Demo

![Open-Audio TTS Demo](public/demo.png)

## Contributing

Contributions are welcome! If you have a suggestion or an issue, please use the [issues](#) page to let me know.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to OpenAI for providing the text-to-speech API.
- Chakra UI for the beautiful component library.
- <a target="_blank" href="https://icons8.com/icon/PgPOu9C2G4Dq/speech-to-text">Speech To Text</a> icon by <a target="_blank" href="https://icons8.com">Icons8</a>
- The repo was forked from [Justmalhar/open-audio](https://github.com/Justmalhar/open-audio)

