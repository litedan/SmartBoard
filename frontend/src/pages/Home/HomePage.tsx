import { AdsFeed } from "../../components/Ads/AdsFeed";
import { RecommendationsBlock } from "../../components/Recommendations/RecommendationsBlock";
import { SearchFilters } from "../../components/Search/SearchFilters";

export function HomePage() {
  return (
    <section>
      <SearchFilters />
      <AdsFeed />
      <RecommendationsBlock />
    </section>
  );
}
