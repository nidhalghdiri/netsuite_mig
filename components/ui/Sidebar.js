import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartBarIcon,
  ArrowsRightLeftIcon,
  ServerIcon,
  CogIcon,
} from "@heroicons/react/24/outline";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: ChartBarIcon },
  { name: "Comparison", href: "/comparison", icon: ArrowsRightLeftIcon },
  { name: "Migration", href: "/migration", icon: ServerIcon },
  { name: "Settings", href: "/settings", icon: CogIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col w-64 h-full border-r border-gray-200 bg-white">
      <div className="flex items-center h-16 px-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="bg-gray-200 border-2 border-dashed rounded-xl w-10 h-10" />
          <span className="ml-3 text-lg font-bold">NetSuite Migrator</span>
        </div>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`${
              pathname === item.href
                ? "bg-gray-800 text-white"
                : "text-gray-300 hover:bg-gray-700 hover:text-white"
            } group flex items-center px-4 py-3 text-sm font-medium rounded-md`}
          >
            <item.icon
              className={`${
                pathname === item.href
                  ? "text-white"
                  : "text-gray-400 group-hover:text-gray-300"
              } mr-3 flex-shrink-0 h-6 w-6`}
              aria-hidden="true"
            />
            {item.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}
