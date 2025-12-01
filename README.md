# 🚀 AI Project Tutorial Builder

An AI-powered Next.js application that analyzes GitHub repositories and automatically generates comprehensive, beginner-friendly tutorials with detailed explanations, code walkthroughs, and Mermaid diagrams.

![Next.js](https://img.shields.io/badge/Next.js-15.3.1-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--3.5/4-green?style=flat-square&logo=openai)
![PocketFlow](https://img.shields.io/badge/PocketFlow-1.0.4-purple?style=flat-square)

## ✨ Features

### Core Capabilities
- 🤖 **AI-Powered Analysis** - Uses OpenAI GPT models to understand code structure and relationships
- 📚 **Beginner-Friendly Tutorials** - Generates step-by-step explanations with analogies and examples
- 🎯 **Automatic Abstraction Detection** - Identifies key concepts, classes, and patterns in your codebase
- 🔄 **Relationship Mapping** - Creates visual Mermaid flowcharts showing how components interact
- 📝 **Multi-Chapter Documentation** - Produces well-structured markdown tutorials with proper navigation

### Additional Features
- 🌍 **Multi-Language Support** - Generate tutorials in different languages (English, Spanish, etc.)
- 💾 **LLM Response Caching** - Reduces API costs by caching identical prompts
- 📊 **Cache Statistics Dashboard** - Monitor cache hit rates and API usage
- 🔍 **Smart File Filtering** - Include/exclude files using glob patterns
- 🎨 **Dark/Light Theme** - Modern UI with theme toggle support
- 📁 **Interactive File Browser** - Browse and view repository files with syntax highlighting
- 💾 **Version Management** - Save and load different crawl versions

## 📋 Prerequisites

- **Node.js** v18 or higher
- **npm** or **yarn** package manager
- **OpenAI API Key** (required for tutorial generation)
- **GitHub Token** (optional, increases rate limits from 60 to 5,000 requests/hour)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/jsayram/github_scrapper_app.git
cd github_scrapper_app
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Required: OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional: Alternative OpenAI key names (the app checks multiple)
# OPEN_AI_API_KEY=your-key
# OPENROUTER_API_KEY=your-key

# Optional: OpenAI Model (defaults to gpt-3.5-turbo)
OPEN_AI_MODEL=gpt-3.5-turbo
# For better results, use: gpt-4 or gpt-4-turbo

# Optional: GitHub Personal Access Token (increases rate limit)
GITHUB_TOKEN=ghp_your-github-token-here

# Optional: Output directory for generated tutorials
OUTPUT_DIRECTORY=output

# Optional: Log directory for LLM calls
LOG_DIR=logs

# Optional: Cache file location
LLM_CACHE_FILE=llm_cache.json
```

### 4. Start the Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎮 Usage

### Basic Workflow

1. **Enter Repository URL** - Paste any public GitHub repository URL (e.g., `https://github.com/user/repo`)

2. **Configure Filters (Optional)**
   - **Include Patterns**: Select file types to analyze (`.py`, `.ts`, `.js`, `.java`, etc.)
   - **Exclude Patterns**: Skip test files, build outputs, media files, etc.

3. **Add GitHub Token (Optional)** - For private repos or higher rate limits

4. **Fetch Repository** - Click "Fetch Repo" to crawl and download repository files

5. **Generate Tutorial** - Click "Create Tutorial" to start the AI analysis

6. **View Results** - Tutorial files are generated in the `output/[project-name]/` directory

### Example Output Structure

```
output/
└── PizzaAndBurgersRestaurant/
    ├── index.md                    # Tutorial overview with Mermaid diagram
    ├── 01_user_interface.md        # Chapter 1: User Interface
    ├── 02_menu_items.md            # Chapter 2: Menu Items
    ├── 03_toppings.md              # Chapter 3: Toppings
    ├── 04_extra_items.md           # Chapter 4: Extra Items
    └── 05_order_management.md      # Chapter 5: Order Management
```

### Sample Generated Content

The `index.md` includes:
- Project summary
- Source repository link
- Mermaid flowchart of component relationships
- Ordered chapter listing with navigation links

Each chapter includes:
- High-level motivation and use cases
- Beginner-friendly explanations with analogies
- Code snippets (under 10 lines each) with explanations
- Mermaid sequence diagrams for complex flows
- Navigation links to previous/next chapters

## 🏗️ Architecture

### Tutorial Generation Pipeline (PocketFlow)

The application uses [PocketFlow](https://github.com/pocketflow/pocketflow) to orchestrate the tutorial generation:

```
FetchRepo → IdentifyAbstractions → AnalyzeRelationships → OrderChapters → WriteChapters → CombineTutorial
```

| Node | Description |
|------|-------------|
| **FetchRepo** | Crawls GitHub repository and downloads file contents |
| **IdentifyAbstractions** | Uses LLM to identify key concepts (max 5-10) |
| **AnalyzeRelationships** | Determines how abstractions relate to each other |
| **OrderChapters** | Decides optimal teaching order (foundational → advanced) |
| **WriteChapters** | Generates markdown content for each chapter |
| **CombineTutorial** | Combines all chapters into final tutorial with index |

### Project Structure

```
github_scrapper_app/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Main application page
│   │   ├── layout.tsx                # Root layout with theme provider
│   │   ├── api/
│   │   │   ├── github-crawler/       # GitHub API proxy endpoint
│   │   │   │   └── route.ts
│   │   │   ├── llm/                  # OpenAI API endpoint
│   │   │   │   ├── route.ts
│   │   │   │   └── cache-stats/      # Cache statistics endpoint
│   │   │   └── tutorial-generator/   # Tutorial generation endpoint
│   │   │       └── route.ts
│   │   ├── cache-stats/              # Cache statistics page
│   │   └── llm-test/                 # LLM testing page
│   │
│   ├── components/                   # React Components
│   │   ├── ActionButtons.tsx         # Main action buttons (Fetch, Create Tutorial)
│   │   ├── CacheStats.tsx            # Cache statistics display
│   │   ├── CodeEditor.tsx            # Monaco-based code viewer
│   │   ├── FileBrowser.tsx           # File tree navigation
│   │   ├── FileExplorer.tsx          # Combined file browser + editor
│   │   ├── FilterSection.tsx         # Include/exclude pattern filters
│   │   ├── Header.tsx                # Application header
│   │   ├── RepositoryForm.tsx        # URL and token input form
│   │   ├── SaveToFile.tsx            # Version save/load functionality
│   │   ├── StatsDisplay.tsx          # Repository statistics
│   │   ├── theme-toggle.tsx          # Dark/light theme switcher
│   │   └── ui/                       # shadcn/ui components
│   │
│   └── lib/                          # Core Library Functions
│       ├── nodes.tsx                 # PocketFlow node implementations
│       ├── tutorialFlow.tsx          # Flow orchestration
│       ├── githubFileCrawler.tsx     # GitHub API integration
│       ├── llm.tsx                   # OpenAI API with caching
│       ├── includedPatterns.tsx      # Default include patterns
│       ├── excludedPatterns.tsx      # Default exclude patterns
│       └── utils.ts                  # Utility functions
│
├── output/                           # Generated tutorials
├── logs/                             # LLM call logs and saved versions
├── llm_cache.json                    # LLM response cache
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── next.config.ts
```

## 🔧 Configuration Options

### File Patterns

#### Included Patterns (Default)
| Category | Extensions |
|----------|------------|
| Web Development | `.html`, `.css`, `.scss`, `.js`, `.jsx`, `.ts`, `.tsx` |
| Backend | `.py`, `.java`, `.go`, `.rb`, `.php`, `.c`, `.cpp`, `.cs`, `.rs` |
| Data & Config | `.json`, `.yaml`, `.yml`, `.xml`, `.toml` |
| Documentation | `.md`, `.rst`, `.txt` |

#### Excluded Patterns (Default)
| Category | Patterns |
|----------|----------|
| Dependencies | `node_modules/`, `vendor/`, `venv/` |
| Build Output | `dist/`, `build/`, `.next/` |
| Test Files | `test/`, `tests/`, `*test.js`, `*spec.ts` |
| Media Files | `.mp4`, `.png`, `.jpg`, `.gif`, etc. |
| Lock Files | `package-lock.json`, `yarn.lock`, `poetry.lock` |

### LLM Settings

| Parameter | Default | Description |
|-----------|---------|-------------|
| `model` | `gpt-3.5-turbo` | OpenAI model to use |
| `temperature` | `0.2` | Response creativity (0-1) |
| `maxTokens` | `4096` | Maximum response length |
| `useCache` | `true` | Enable response caching |
| `max_abstraction_num` | `5` | Maximum concepts to identify |

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/github-crawler` | POST | Fetch files from GitHub repository |
| `/api/tutorial-generator` | POST | Generate tutorial from files |
| `/api/llm` | POST | Direct LLM API access |
| `/api/llm/cache-stats` | GET | Get cache statistics |

## 🧪 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint for code quality |

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Tips

- Run `npm run lint` to check for linting errors
- Test with small repositories first to save API costs
- Enable caching during development to avoid redundant API calls
- Check `/cache-stats` page to monitor API usage

## ❓ Troubleshooting

### Common Issues

**"No OpenAI API key found"**
- Ensure `OPENAI_API_KEY` is set in `.env.local`
- Restart the development server after adding environment variables

**"GitHub API rate limit exceeded"**
- Add a GitHub personal access token to increase limits
- Wait for rate limit reset (shown in error message)

**"Failed to fetch files"**
- Check if the repository URL is correct and accessible
- For private repos, ensure your GitHub token has appropriate permissions

**Tutorial generation is slow**
- This is normal for larger repositories
- Enable caching to speed up subsequent runs
- Consider using `gpt-3.5-turbo` instead of `gpt-4` for faster (but less detailed) results

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/) and [React](https://react.dev/)
- AI powered by [OpenAI](https://openai.com/)
- Workflow orchestration by [PocketFlow](https://github.com/pocketflow/pocketflow)
- Code editor by [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

---

**Generated tutorials include attribution to [Code Detail's AI Project Tutorial Builder](https://codedetails.io)**
