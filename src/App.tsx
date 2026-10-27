"use client";

import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import ScrollToTop from "./components/ScrollToTop";
import { SplashScreen } from "./components/SplashScreen";
import { PageTransition } from "./components/PageTransition";

// Fallback component for Suspense
const PageLoader = () => (
  <div className="container py-8 space-y-6">
    <Skeleton className="h-10 w-48" />
    <Skeleton className="h-96 w-full rounded-2xl" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  </div>
);

// Lazy Loaded Pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Submit = lazy(() => import("./pages/Submit"));
const SubmitStatus = lazy(() => import("./pages/SubmitStatus"));
const Submissions = lazy(() => import("./pages/Submissions"));
const VideoDetails = lazy(() => import("./pages/VideoDetails"));
const Videos = lazy(() => import("./pages/Videos"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Community = lazy(() => import("./pages/Community"));
const Curation = lazy(() => import("./pages/Curation"));
const Facodi = lazy(() => import("./pages/Facodi"));
const FacodiKnowledge = lazy(() => import("./pages/FacodiKnowledge"));
const About = lazy(() => import("./pages/About"));
const Rules = lazy(() => import("./pages/Rules"));
const Contact = lazy(() => import("./pages/Contact"));
const FAQ = lazy(() => import("./pages/FAQ"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const Playlists = lazy(() => import("./pages/Playlists"));
const PlaylistImportProgress = lazy(() => import("./pages/PlaylistImportProgress"));
const PlaylistDetails = lazy(() => import("./pages/PlaylistDetails"));
const CreateEditPlaylist = lazy(() => import("./pages/CreateEditPlaylist"));
const Profile = lazy(() => import("./pages/Profile"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const Messages = lazy(() => import("./pages/Messages"));
const Notifications = lazy(() => import("./pages/Notifications"));
const EditorialPortal = lazy(() => import("./pages/EditorialPortal"));
const EditorBoard = lazy(() => import("./pages/EditorBoard"));
const EditorApply = lazy(() => import("./pages/EditorApply"));
const EditorApplications = lazy(() => import("./pages/EditorApplications"));
const NotFound = lazy(() => import("./pages/NotFound"));
const YouTubeRouteBridge = lazy(() => import("./pages/YouTubeRouteBridge"));
const SmartSlugRoute = lazy(() => import("./pages/SmartSlugRoute"));

const App = () => (
  <>
    <SplashScreen />
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <PageTransition>
          <Routes>
            <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/verify-email" element={<VerifyEmail />} />
        <Route path="/submit" element={<Submit />} />
        <Route path="/submit/status/:submissionId" element={<SubmitStatus />} />
        <Route path="/submissions" element={<Submissions />} />
        <Route path="/watch" element={<YouTubeRouteBridge />} />
        <Route path="/shorts/:id" element={<YouTubeRouteBridge />} />
        <Route path="/live/:id" element={<YouTubeRouteBridge />} />
        <Route path="/embed/:id" element={<YouTubeRouteBridge />} />
        <Route path="/v/:id" element={<YouTubeRouteBridge />} />
        <Route path="/videos/:videoId" element={<VideoDetails />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/community" element={<Community />} />
        <Route path="/curadoria" element={<Curation />} />
        <Route path="/facodi" element={<Facodi />} />
        <Route path="/facodi/knowledge" element={<FacodiKnowledge />} />
        <Route path="/about" element={<About />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/cookies" element={<CookiePolicy />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlists/import/progress" element={<PlaylistImportProgress />} />
        <Route path="/playlists/new" element={<CreateEditPlaylist />} />
        <Route path="/playlists/:playlistId" element={<PlaylistDetails />} />
        <Route path="/playlists/:playlistId/edit" element={<CreateEditPlaylist />} />
        <Route path="/profile/:username" element={<Profile />} />
        <Route path="/profile/edit" element={<EditProfile />} />
        <Route path="/account/settings" element={<AccountSettings />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/editorial" element={<EditorialPortal />} />
        <Route path="/editor/board" element={<EditorBoard />} />
        <Route path="/editor/apply" element={<EditorApply />} />
        <Route path="/editor/applications" element={<EditorApplications />} />
        <Route path="/:username" element={<SmartSlugRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </PageTransition>
    </Suspense>
  </BrowserRouter>
  </>
);

export default App;
