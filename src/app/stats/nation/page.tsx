'use client';

import { Card, CardHeader, CardBody } from '@heroui/card';

export default function PlaceholderPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-800 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-5xl">
        {[...Array(6)].map((_, index) => (
          <Card key={index} className="shadow-md">
            <CardHeader className="text-2xl font-semibold">Card {index + 1}</CardHeader>
            <CardBody>
              <p className="text-gray-600">This is a placeholder for content #{index + 1}.</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </main>
  );
}