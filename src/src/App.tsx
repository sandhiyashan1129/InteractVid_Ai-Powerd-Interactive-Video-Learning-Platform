import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Upload from "./pages/Upload.tsx";
import Learning from "./pages/Learning.tsx";
import VideoDetail from "./pages/VideoDetail.tsx";
import Notes from "./pages/Notes.tsx";
import Quiz from "./pages/Quiz.tsx";
import Progress from "./pages/Progress.tsx";
import Chat from "./pages/Chat.tsx";
import Teacher from "./pages/Teacher.tsx";
import Settings from "./pages/Settings.tsx";
import Leaderboard from "./pages/Leaderboard.tsx";
import Profile from "./pages/Profile.tsx";
import NotFound from "./pages/NotFound.tsx";
import Exam from "./pages/Exam.tsx";
import Achievements from "./pages/Achievements.tsx";

const queryClient = new QueryClient();

const wrap = (el: React.ReactNode) => <AppLayout>{el}</AppLayout>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={wrap(<Index />)} />
            <Route path="/upload" element={wrap(<Upload />)} />
            <Route path="/learning" element={wrap(<Learning />)} />
            <Route path="/video/:id" element={wrap(<VideoDetail />)} />
            <Route path="/notes" element={wrap(<Notes />)} />
            <Route path="/quiz" element={wrap(<Quiz />)} />
            <Route path="/progress" element={wrap(<Progress />)} />
            <Route path="/chat" element={wrap(<Chat />)} />
            <Route path="/teacher" element={wrap(<Teacher />)} />
            <Route path="/leaderboard" element={wrap(<Leaderboard />)} />
            <Route path="/profile" element={wrap(<Profile />)} />
            <Route path="/settings" element={wrap(<Settings />)} />
            <Route path="/exam/:id" element={wrap(<Exam />)} />
            <Route path="/achievements" element={wrap(<Achievements />)} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
