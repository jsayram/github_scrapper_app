// Included file patterns for Github Repository Crawler
// Organized into categories for better maintenance

interface PatternCategory {
  label: string;
  pattern: string[];
  description: string;
}

export const includedPatternCategories: PatternCategory[] = [
  {
    label: "Web Development",
    pattern: [
      "**/*.html",
      "**/*.css",
      "**/*.scss",
      "**/*.sass",
      "**/*.less",
      "**/*.js",
      "**/*.jsx",
      "**/*.ts",
      "**/*.tsx"
    ],
    description: "Common web development files including HTML, CSS, and JavaScript/TypeScript files"
  },
  {
    label: "Backend",
    pattern: [
      "**/*.py",
      "**/*.java",
      "**/*.go",
      "**/*.rb",
      "**/*.php",
      "**/*.c",
      "**/*.cpp",
      "**/*.cs",
      "**/*.rs"
    ],
    description: "Backend development languages including Python, Java, Go, Ruby, PHP, C/C++, C#, and Rust"
  },
  {
    label: "Data & Configuration",
    pattern: [
      "**/*.json",
      "**/*.yaml",
      "**/*.yml",
      "**/*.xml",
      "**/*.toml",
      "**/*.ini",
      "**/*.env.example"
    ],
    description: "Data and configuration files in various formats"
  },
  {
    label: "Documentation",
    pattern: [
      "**/*.md",
      "**/*.mdx",
      "**/*.markdown",
      "**/*.txt",
      "**/*.rst", 
      "**/*.adoc"
    ],
    description: "Markdown and plain text documentation files"
  },
  {
    label: "Mobile Development",
    pattern: [
      "**/*.swift",
      "**/*.kt",
      "**/*.m",
      "**/*.mm",
      "**/*.dart"
    ],
    description: "Mobile app development files for iOS, Android, and Flutter"
  },
  {
    label: "Infrastructure",
    pattern: [
      "**/*.tf",
      "**/*.hcl",
      "**/Dockerfile",
      "**/docker-compose.yml",
      "**/docker-compose.yaml"
    ],
    description: "Infrastructure as code and container configuration files"
  },
  {
    label: "Database",
    pattern: [
      "**/*.sql",
      "**/*.prisma",
      "**/*.mongodb",
      "**/*.graphql",
      "**/*.gql"
    ],
    description: "Database schema and query files"
  },
  {
    label: "Shell Scripts",
    pattern: [
      "**/*.sh",
      "**/*.bash",
      "**/*.zsh",
      "**/*.bat",
      "**/*.cmd",
      "**/*.ps1"
    ],
    description: "Shell and batch script files for automation"
  },
  {
    label: "Machine Learning",
    pattern: [
      "**/models/*.py",
      "**/nn/*.py",
      "**/torch/*.py",
      "**/tensorflow/*.py",
      "**/keras/*.py",
      "**/*.ipynb"
    ],
    description: "Machine learning and data science related files"
  },
  {
    label: "Smart Contracts",
    pattern: [
      "**/*.sol",
      "**/*.vy"
    ],
    description: "Blockchain smart contract files"
  },
  {
    label: "System Programming",
    pattern: [
      "**/*.cu",
      "**/*.cuh",
      "**/*.asm",
      "**/*.s"
    ],
    description: "CUDA, assembly and other system programming files"
  },
  {
    label: "Web Assembly",
    pattern: [
      "**/*.wat",
      "**/*.wasm"
    ],
    description: "WebAssembly text and binary format files"
  },
  {
    label: "Serialization & RPC",
    pattern: [
      "**/*.proto",
      "**/*.avro",
      "**/*.thrift"
    ],
    description: "Protocol buffer, Avro, and Thrift schema files"
  }
];

// Helper function to extract all patterns into a flat array
export const getAllIncludedPatterns = (): string[] => {
  return includedPatternCategories.flatMap(category => category.pattern);
};

// Get patterns by specific category
export const getPatternsByCategory = (categoryLabel: string): string[] => {
  const category = includedPatternCategories.find(cat => cat.label === categoryLabel);
  return category ? category.pattern : [];
};