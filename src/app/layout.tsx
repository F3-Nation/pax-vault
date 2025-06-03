// app/layout.tsx

// globals.css includes @tailwind directives
// adjust the path if necessary
import "@/styles/globals.css";
import {Providers} from "./providers";
import NavbarComponent from "@/components/navbar-server";

export default function RootLayout({children}: { children: React.ReactNode }) {
  return (
    <html lang="en" className='dark'>
      <body>
        <NavbarComponent />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}