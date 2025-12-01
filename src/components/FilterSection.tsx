import React from 'react';
import { excludedPatternCategories, getAllExcludedPatterns } from "@/lib/excludedPatterns";

interface FilterSectionProps {
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  showExcludePatterns: boolean;
  setShowExcludePatterns: (show: boolean) => void;
  includePatterns: string[];
  setIncludePatterns: (patterns: string[]) => void;
  excludePatterns: string[];
  setExcludePatterns: (patterns: string[]) => void;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  showFilters,
  setShowFilters,
  showExcludePatterns,
  setShowExcludePatterns,
  includePatterns,
  setIncludePatterns,
  excludePatterns,
  setExcludePatterns
}) => {
  return (
    <>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
        >
          {showFilters ? "▼" : "►"} {showFilters ? "Hide" : "Show"} file
          filters
        </button>
      </div>

      {showFilters && (
        <div className="mb-6 border rounded-md p-4 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 sticky top-0 bg-white dark:bg-gray-900 py-1">
                Include File Types
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent pr-2">
                {[
                  { label: "Python", pattern: "*.py,**/*.py" },
                  { label: "JavaScript", pattern: "*.js,**/*.js,*.mjs,**/*.mjs,*.cjs,**/*.cjs" },
                  { label: "TypeScript", pattern: "*.ts,**/*.ts,*.d.ts,**/*.d.ts,*.mts,**/*.mts" },
                  { label: "TSX", pattern: "*.tsx,**/*.tsx" },
                  { label: "JSX", pattern: "*.jsx,**/*.jsx" },
                  { label: "C#", pattern: "*.cs,**/*.cs" },
                  { label: "Java", pattern: "*.java,**/*.java" },
                  {
                    label: "Markdown",
                    pattern: "*.md,**/*.md,README.*,**/README.*,CONTRIBUTING.*,CHANGELOG.*",
                  },
                  { label: "MDX", pattern: "*.mdx,**/*.mdx" },
                  { label: "HTML", pattern: "*.html,**/*.html,*.htm,**/*.htm" },
                  { label: "CSS", pattern: "*.css,**/*.css" },
                  { label: "SCSS/SASS", pattern: "*.scss,**/*.scss,*.sass,**/*.sass" },
                  { label: "Less", pattern: "*.less,**/*.less" },
                  { label: "JSON", pattern: "*.json,**/*.json" },
                  { label: "XML", pattern: "*.xml,**/*.xml" },
                  { label: "YAML", pattern: "*.yml,**/*.yml,*.yaml,**/*.yaml" },
                  { label: "Rust", pattern: "*.rs,**/*.rs" },
                  { label: "Go", pattern: "*.go,**/*.go" },
                  { label: "Ruby", pattern: "*.rb,**/*.rb" },
                  { label: "PHP", pattern: "*.php,**/*.php" },
                  { label: "Swift", pattern: "*.swift,**/*.swift" },
                  { label: "C/C++", pattern: "*.c,**/*.c,*.cpp,**/*.cpp,*.h,**/*.h,*.hpp,**/*.hpp,*.cc,**/*.cc" },
                  { label: "SQL", pattern: "*.sql,**/*.sql" },
                  { label: "Kotlin", pattern: "*.kt,**/*.kt,*.kts,**/*.kts" },
                  { label: "Dart", pattern: "*.dart,**/*.dart" },
                  { label: "Shell/Bash", pattern: "*.sh,**/*.sh,*.bash,**/*.bash" },
                  { label: "PowerShell", pattern: "*.ps1,**/*.ps1" },
                  { label: "Assembly", pattern: "*.asm,**/*.asm" },
                  { label: "Lua", pattern: "*.lua,**/*.lua" },
                  { label: "R", pattern: "*.r,**/*.r,*.R,**/*.R" },
                  { label: "MATLAB/Objective-C", pattern: "*.m,**/*.m" },
                  { label: "Julia", pattern: "*.jl,**/*.jl" },
                  { label: "Haskell", pattern: "*.hs,**/*.hs,*.lhs,**/*.lhs" },
                  { label: "Elixir", pattern: "*.ex,**/*.ex,*.exs,**/*.exs" },
                  { label: "Erlang", pattern: "*.erl,**/*.erl,*.hrl,**/*.hrl" },
                  { label: "Scala", pattern: "*.scala,**/*.scala,*.sc,**/*.sc" },
                  { label: "Clojure", pattern: "*.clj,**/*.clj,*.cljs,**/*.cljs,*.cljc,**/*.cljc" },
                  { label: "GraphQL", pattern: "*.graphql,**/*.graphql,*.gql,**/*.gql" },
                  { label: "Docker", pattern: "Dockerfile,**/Dockerfile,*.dockerfile,**/*.dockerfile" },
                  { label: "Terraform", pattern: "*.tf,**/*.tf" },
                  {
                    label: "Web Frameworks",
                    pattern: "*.svelte,**/*.svelte,*.vue,**/*.vue,*.astro,**/*.astro",
                  },
                  { label: "ReasonML", pattern: "*.re,**/*.re,*.rei,**/*.rei" },
                  { label: "F#", pattern: "*.fs,**/*.fs,*.fsx,**/*.fsx" },
                  { label: "Groovy", pattern: "*.groovy,**/*.groovy" },
                  { label: "Perl", pattern: "*.pl,**/*.pl,*.pm,**/*.pm" },
                  { label: "Config Files", pattern: "*.toml,**/*.toml,*.properties,**/*.properties" },
                  { label: "Documentation", pattern: "*.txt,**/*.txt,*.rst,**/*.rst,*.adoc,**/*.adoc" },
                  { label: "Protobuf", pattern: "*.proto,**/*.proto" },
                  { label: "WebAssembly", pattern: "*.wat" },
                  { label: "Objective-C", pattern: "*.mm" },
                  { label: "Smart Contracts", pattern: "*.sol,*.vy" },
                  { label: "Jupyter Notebook", pattern: "*.ipynb" },
                  {
                    label: "ML/AI",
                    pattern:
                      "**/models/*.py,**/nn/*.py,**/torch/*.py,**/tensorflow/*.py,**/keras/*.py",
                  },
                  { label: "CUDA", pattern: "*.cu,*.cuh" },
                ].map((type) => (
                  <div key={type.label} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`include-${type.label}`}
                      checked={type.pattern
                        .split(",")
                        .some((p) => includePatterns.includes(p))}
                      onChange={(e) => {
                        const patterns = type.pattern.split(",");
                        if (e.target.checked) {
                          setIncludePatterns([
                            ...includePatterns,
                            ...patterns.filter(
                              (p) => !includePatterns.includes(p)
                            ),
                          ]);
                        } else {
                          setIncludePatterns(
                            includePatterns.filter(
                              (p) => !patterns.includes(p)
                            )
                          );
                        }
                      }}
                      className="mr-2"
                    />
                    <label
                      htmlFor={`include-${type.label}`}
                      className="text-sm"
                    >
                      {type.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Exclude Patterns
              </label>
              <button
                type="button"
                onClick={() => setShowExcludePatterns(!showExcludePatterns)}
                className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
              >
                {showExcludePatterns ? "▼" : "►"}{" "}
                {showExcludePatterns ? "Hide" : "Show"} exclude patterns
                <span className="ml-2 text-xs text-gray-500">
                  ({excludePatterns.length} patterns)
                </span>
              </button>

              {showExcludePatterns && (
                <div className="grid grid-cols-1 gap-2 mt-4">
                  {excludedPatternCategories.map((type) => (
                    <div key={type.label} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`exclude-${type.label}`}
                        checked={type.pattern.some((p) =>
                          excludePatterns.includes(p)
                        )}
                        onChange={(e) => {
                          // If this is a required exclusion, don't allow it to be unchecked
                          if (type.required && !e.target.checked) {
                            return;
                          }

                          const patterns = type.pattern;
                          if (e.target.checked) {
                            setExcludePatterns([
                              ...excludePatterns,
                              ...patterns.filter(
                                (p) => !excludePatterns.includes(p)
                              ),
                            ]);
                          } else {
                            setExcludePatterns(
                              excludePatterns.filter(
                                (p) => !patterns.includes(p)
                              )
                            );
                          }
                        }}
                        className="mr-2"
                        disabled={type.required}
                      />
                      <label
                        htmlFor={`exclude-${type.label}`}
                        className={`text-sm flex items-center ${
                          type.required ? "cursor-not-allowed" : ""
                        }`}
                      >
                        {type.label}
                        {type.required && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200">
                            Required
                          </span>
                        )}
                        {type.required && (
                          <span className="ml-2 group relative">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4 text-gray-500 cursor-help"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-1 invisible group-hover:visible w-64 bg-black dark:bg-white text-white dark:text-black text-xs rounded p-2 z-10">
                              {type.reason}
                            </div>
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-full">
              <label className="block text-sm font-medium mb-1">
                Custom Patterns
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="Custom include pattern (e.g., src/**/*.jsx)"
                    className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value) {
                        e.preventDefault();
                        setIncludePatterns([
                          ...includePatterns,
                          e.currentTarget.value,
                        ]);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {includePatterns.map((pattern, i) => (
                      <span
                        key={i}
                        className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded-full text-xs flex items-center"
                      >
                        {pattern}
                        <button
                          type="button"
                          onClick={() =>
                            setIncludePatterns(
                              includePatterns.filter((_, idx) => idx !== i)
                            )
                          }
                          className="ml-1 text-red-500 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Custom exclude pattern (e.g., **/.git/**)"
                    className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value) {
                        e.preventDefault();
                        setExcludePatterns([
                          ...excludePatterns,
                          e.currentTarget.value,
                        ]);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  {showExcludePatterns && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {excludePatterns.map((pattern, i) => {
                        // Check if this pattern is part of any required exclude group
                        const isRequiredPattern =
                          getAllExcludedPatterns().includes(pattern);

                        return (
                          <span
                            key={i}
                            className={`${
                              isRequiredPattern
                                ? "bg-gray-200 dark:bg-gray-700"
                                : "bg-red-100 dark:bg-red-900"
                            } px-2 py-1 rounded-full text-xs flex items-center`}
                          >
                            {pattern}
                            {!isRequiredPattern && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExcludePatterns(
                                    excludePatterns.filter(
                                      (_, idx) => idx !== i
                                    )
                                  )
                                }
                                className="ml-1 text-red-500 font-bold"
                              >
                                ×
                              </button>
                            )}
                            {isRequiredPattern && (
                              <span
                                className="ml-1 text-gray-500"
                                title="This pattern is required and can't be removed"
                              >
                                🔒
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FilterSection;