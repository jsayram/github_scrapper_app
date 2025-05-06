import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import { VersionInfo } from "./SaveToFile";

interface HeaderProps {
  activeVersion: VersionInfo | null;
  onClearVersion: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeVersion, onClearVersion }) => {
  return (
    <header className="mb-6 flex flex-col items-center relative">
      <div className="absolute right-0 top-0">
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