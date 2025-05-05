// Excluded file patterns for Github Repository Crawler
// Organized into categories for better maintenance

interface PatternCategory {
  label: string;
  pattern: string[];
  required: boolean;
  reason: string;
}

export const excludedPatternCategories: PatternCategory[] = [
  {
    label: "Test Files",
    pattern: [
      "test/*",
      "tests/*",
      "**/test/**",
      "**/tests/**",
      "**/__tests__/**",
      "**/*test.js",
      "**/*spec.js",
      "**/*test.ts",
      "**/*spec.ts"
    ],
    required: true,
    reason: "Test files often duplicate source code logic and can double API usage without adding value to code understanding"
  },
  {
    label: "Large Media Files",
    pattern: [
      // Video formats
      "**/*.mp4", "**/*.mov", "**/*.avi", "**/*.mkv", "**/*.webm", 
      "**/*.flv", "**/*.wmv", "**/*.m4v", "**/*.mpeg", "**/*.mpg", 
      "**/*.mpe", "**/*.vob", "**/*.qt", "**/*.swf",
      
      // Audio formats
      "**/*.mp3", "**/*.wav", "**/*.flac", "**/*.aac", "**/*.ogg", 
      "**/*.mp2", "**/*.m4a",
      
      // Image formats
      "**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.gif", "**/*.webp", 
      "**/*.svg", "**/*.ico", "**/*.tiff", "**/*.bmp", "**/*.raw", 
      "**/*.heic", "**/*.heif", "**/*.cr2", "**/*.nef", "**/*.tga", 
      "**/*.dicom", "**/*.eps", "**/*.jfif", "**/*.exif", "**/*.pcx", 
      "**/*.jp2", "**/*.apng", "**/*.avif",
      
      // Design files
      "**/*.psd", "**/*.ai", "**/*.xd", "**/*.sketch", "**/*.fig", "**/*.xcf",
      
      // Document formats
      "**/*.pdf",
      
      // 3D formats
      "**/*.blend", "**/*.fbx", "**/*.obj", "**/*.stl", "**/*.3ds", 
      "**/*.dae", "**/*.glb", "**/*.gltf", "**/*.3dm", "**/*.ply", "**/*.max",
      
      // Archive formats
      "**/*.iso", "**/*.zip", "**/*.tar", "**/*.gz", "**/*.rar", "**/*.7z", 
      "**/*.bz2", "**/*.xz", "**/*.tgz"
    ],
    required: true,
    reason: "Binary files that don't contain readable code and would use up API quota"
  },
  {
    label: "Binary Datasets",
    pattern: [
      "**/*.bin",
      "**/*.dat",
      "**/*.pkl",
      "**/*.h5",
      "**/*.hdf5"
    ],
    required: true,
    reason: "Large data files that don't contain readable code"
  },
  {
    label: "Node Modules",
    pattern: [
      "**/node_modules/**",
      "**/node_module/**"
    ],
    required: true,
    reason: "Contains 100,000+ files that would exceed API rate limits"
  },
  {
    label: "Package Files",
    pattern: [
      "**/package-lock.json",
      "**/yarn.lock",
      "**/pnpm-lock.yaml"
    ],
    required: true,
    reason: "Auto-generated files that can be 10,000+ lines long"
  },
  {
    label: "Minified Files",
    pattern: [
      "**/*.min.js",
      "**/*.min.css"
    ],
    required: true,
    reason: "Single-line files that are hard to analyze and have unminified counterparts"
  },
  {
    label: "Build Output",
    pattern: [
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/out/**",
      "**/output/**",
      "**/target/**",
      "**/.output/**",
      "**/_build/**"
    ],
    required: true,
    reason: "Contains generated files that aren't part of the source code"
  },
  {
    label: "Git Files",
    pattern: [
      "**/.git/**",
      "**/.gitignore",
      "**/.gitattributes",
      "**/.gitmodules",
      "**/.github/**",
    ],
    required: true,
    reason: "Contains repository history which would dramatically increase download size"
  },
  {
    label: "Dependency Dirs",
    pattern: [
      "**/bower_components/**",
      "**/.pnp/**",
      "**/jspm_packages/**"
    ],
    required: true,
    reason: "Contains thousands of third-party dependencies, not project source code"
  },
  {
    label: "Python Environments and Cache",
    pattern: [
      "**/.venv/**",
      "**/venv/**",
      "**/.env/**",
      "**/env/**",
      "**/.virtualenv/**",
      "**/virtualenv/**",
      "**/__pycache__/**",
      "**/*.py[cod]",
      "**/*.so",
      "**/*.egg",
      "**/*.egg-info/**",
      "**/.pytest_cache/**"
    ],
    required: true,
    reason: "Contains binary compilation artifacts, not source code"
  },
  {
    label: "Editor Config",
    pattern: [
      "**/.vscode/**",
      "**/.idea/**",
      "**/.eclipse/**",
      "**/.nbproject/**",
      "**/.sublime-*"
    ],
    required: true,
    reason: "IDE configuration files that don't contain actual project code"
  },
  {
    label: "Coverage Reports",
    pattern: [
      "**/coverage/**",
      "**/.coverage",
      "**/.nyc_output/**",
      "**/htmlcov/**"
    ],
    required: true,
    reason: "Generated test coverage reports that don't contain original code"
  },
  {
    label: "Logs",
    pattern: [
      "**/logs/**",
      "**/log/**",
      "**/*.log",
      "**/*.log.*"
    ],
    required: true,
    reason: "Runtime logs that contain execution data but not meaningful code"
  },
  {
    label: "Temp Files",
    pattern: [
      "**/tmp/**",
      "**/temp/**",
      "**/.tmp/**",
      "**/.temp/**",
      "**/*.tmp",
      "**/*.temp",
      "**/.cache/**",
      "**/cache/**"
    ],
    required: true,
    reason: "Temporary files that aren't part of the source code"
  },
  {
    label: "Docker Files",
    pattern: [
      "**/docker-compose.yml",
      "**/docker-compose.yaml",
      "**/Dockerfile",
      "**/.dockerignore"
    ],
    required: true,
    reason: "Environment configuration that doesn't represent the core application code"
  },
  {
    label: "CI Files",
    pattern: [
      "**/.travis.yml",
      "**/.gitlab-ci.yml",
      "**/.circleci/**",
      "**/.github/workflows/**"
    ],
    required: true,
    reason: "CI/CD configuration that doesn't contain application logic"
  },
  {
    label: "Documentation",
    pattern: [
      "**/docs/**",
      "**/doc/**",
      "**/*.md",
      "**/*.mdx",
      "**/*.markdown"
    ],
    required: false,
    reason: "Written documentation that explains but doesn't implement functionality"
  },
  {
    label: "TypeScript Maps",
    pattern: [
      "**/*.js.map",
      "**/*.d.ts.map"
    ],
    required: true,
    reason: "Debug files not needed for code analysis"
  },
  {
    label: "Frontend Build Caches",
    pattern: [
      "**/node_modules/.cache/**",
      "**/.sass-cache/**",
      "**/.parcel-cache/**",
      "**/webpack-stats.json",
      "**/.turbo/**",
      "**/storybook-static/**"
    ],
    required: true,
    reason: "Build tool cache files and generated artifacts that don't contain source code"
  },
  {
    label: "Backend Build Files",
    pattern: [
      "**/.gradle/**",
      "**/.m2/**",
      "**/vendor/**",
      "**/__snapshots__/**",
      "**/Pods/**",
      "**/.serverless/**",
      "**/venv.bak/**",
      "**/.rts2_cache_*/**"
    ],
    required: true,
    reason: "Build artifacts and framework-specific files that aren't actual source code"
  },
  {
    label: "Env & Config Files",
    pattern: [
      "**/.env.local",
      "**/.env.development",
      "**/.env.production",
      "**/.direnv/**",
      "**/terraform.tfstate*",
      "**/cdk.out/**",
      "**/.terraform/**"
    ],
    required: true,
    reason: "Environment configuration files that often contain sensitive data and aren't source code"
  },
  {
    label: "Editor & OS Files",
    pattern: [
      "**/.settings/**",
      "**/.project",
      "**/.classpath",
      "**/*.swp",
      "**/*~",
      "**/*.bak",
      "**/.DS_Store",
      ".DS_Store",
      "**/Thumbs.db"
    ],
    required: true,
    reason: "Editor and operating system metadata files that don't contain project code"
  },
  {
    label: "Compiled Binaries",
    pattern: [
      "**/*.class",
      "**/*.o",
      "**/*.dll",
      "**/*.exe",
      "**/*.obj",
      "**/*.apk",
      "**/*.ipa"
    ],
    required: true,
    reason: "Compiled binary files that are generated from source code"
  }
];

// Helper function to extract all patterns into a flat array
export const getAllExcludedPatterns = (): string[] => {
  return excludedPatternCategories.flatMap(category => category.pattern);
};

// Get only required patterns
export const getRequiredExcludedPatterns = (): string[] => {
  return excludedPatternCategories
    .filter(category => category.required)
    .flatMap(category => category.pattern);
};