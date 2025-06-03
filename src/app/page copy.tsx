
import Image from "next/image";
import Link from "next/link";
import { MapPinIcon, UserIcon, MapIcon } from "@/components/icons";
import { Card, CardBody } from "@heroui/card"

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <Card>
      <CardBody>
        <p>Make beautiful websites regardless of your design experience.</p>
      </CardBody>
    </Card>
      <main className="flex flex-col gap-8 row-start-2 items-center w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-center">F3 Pax Stats Navigation</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
          <Link href="/stats/region" className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 shadow-md rounded-lg p-6 flex flex-col items-center justify-center hover:shadow-xl transition-shadow">
            <MapIcon className="w-10 h-10 text-blue-600" />
            <span className="mt-4 font-semibold text-lg">Regions</span>
          </Link>
          <Link href="/stats/ao" className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 shadow-md rounded-lg p-6 flex flex-col items-center justify-center hover:shadow-xl transition-shadow">
            <MapPinIcon className="w-10 h-10 text-green-600" />
            <span className="mt-4 font-semibold text-lg">AOs</span>
          </Link>
          <Link href="/stats/pax" className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 shadow-md rounded-lg p-6 flex flex-col items-center justify-center hover:shadow-xl transition-shadow">
            <UserIcon className="w-10 h-10 text-purple-600" />
            <span className="mt-4 font-semibold text-lg">PAX</span>
          </Link>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
