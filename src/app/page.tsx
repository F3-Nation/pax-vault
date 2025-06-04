
import { Card, CardHeader, CardBody } from "@heroui/card";

export default function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center text-2xl font-bold">Welcome to the App</CardHeader>
        <CardBody className="p-6">
          <p className="text-gray-700">This is a simple card component using HeroUI.</p>
        </CardBody>
      </Card>
    </div>
  );
}
