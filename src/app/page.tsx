import Link from "next/link";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";

export default function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
        {/* <CardHeader className="text-center text-2xl font-bold">Welcome to the App</CardHeader> */}
        <CardBody className="p-6">
          {/* <p className="text-gray-700">This is a simple card component using HeroUI.</p> */}
          <Link href="/stats/pax/3559">
            <Button variant="bordered" color="primary">
              View Sample Pax Stats
            </Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
