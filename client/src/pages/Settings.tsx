import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun } from "lucide-react";

export default function Settings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your preferences and account settings</p>
        </div>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize how the application looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Choose between light and dark mode
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => theme !== "light" && toggleTheme?.()}
                  className="gap-2"
                >
                  <Sun className="w-4 h-4" />
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => theme !== "dark" && toggleTheme?.()}
                  className="gap-2"
                >
                  <Moon className="w-4 h-4" />
                  Dark
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Learning Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Learning Preferences</CardTitle>
            <CardDescription>Customize your learning experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Default Quiz Length</p>
                <p className="text-sm text-muted-foreground">Number of questions for generated quizzes</p>
              </div>
              <select className="px-3 py-2 border rounded-md bg-background">
                <option>5 questions</option>
                <option>10 questions</option>
                <option>15 questions</option>
                <option>20 questions</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Default Flashcard Count</p>
                <p className="text-sm text-muted-foreground">Number of flashcards to generate</p>
              </div>
              <select className="px-3 py-2 border rounded-md bg-background">
                <option>5 cards</option>
                <option>10 cards</option>
                <option>15 cards</option>
                <option>20 cards</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Cognify v1.0
            </p>
            <p className="text-sm text-muted-foreground">
              Powered by Google Gemini AI and built with React, Express, and MongoDB.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
