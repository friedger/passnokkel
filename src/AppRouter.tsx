import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import HowItWorks from "./pages/HowItWorks";
import Presentation from "./pages/Presentation";
import Wallet from "./pages/Wallet";
import Export from "./pages/Export";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

export function AppRouter() {
  return (
    // basename keeps routes working under the GitHub Pages subpath (/passnokkel/).
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/presentation" element={<Presentation />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/export" element={<Export />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1.
            Keep specific routes above this — it matches any single segment. */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;