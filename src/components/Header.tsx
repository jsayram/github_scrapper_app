import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { VersionInfo } from "./SaveToFile";

interface HeaderProps {
  activeVersion: VersionInfo | null;
  onClearVersion: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeVersion, onClearVersion }) => {
  return (
    <header className="mb-6 flex flex-col items-center relative">
      <div className="absolute right-0 top-0 flex items-center gap-2">
        <Link 
          href="/llm-test"
          className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-md hover:from-purple-600 hover:to-blue-600 transition-all shadow-sm"
        >
          🧪 Test LLM
        </Link>
        <Link 
          href="/cache-stats"
          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
        >
          📊 Cache
        </Link>
        <ThemeToggle />
      </div>
      <Image
        className="dark:invert mb-4"
        src="/next.svg"
        alt="Next.js logo"
        width={180}
        height={38}
        priority
      />
      <h1 className="text-2xl font-bold mb-2">GitHub Repository Crawler</h1>
      <p className="text-gray-600 dark:text-gray-300">
        Browse and save files from any GitHub repository
      </p>
      {activeVersion && (
        <div className="mt-2 py-1 px-3 bg-blue-100 dark:bg-blue-900 rounded-full text-sm">
          Viewing saved version:{" "}
          <span className="font-bold">{activeVersion.name}</span>
          <button
            type="button"
            className="ml-2 text-blue-600 dark:text-blue-400 text-xs hover:underline"
            onClick={onClearVersion}
          >
            Clear
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;