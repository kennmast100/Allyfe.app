import { BottomNav } from './components/ui';
import { useApp, type Route } from './store/store';
import type { User } from './domain/types';
import { Applied, ArtisanHome, ArtisanJob, ArtisanJobs, ProposalForm, Rent, Store, Verify } from './screens/artisan';
import { ClientHome, ClientJob, Completed, ConfirmProposal, Discover, JobPosted, PostJob, ProProfile, Projects, ReviewForm } from './screens/client';
import { CompanyHome, Requests, Tools } from './screens/company';
import { Alerts, Comments, Composer, Feed, Me, Offline, OfflineBanner, SignIn, Wallet } from './screens/shared';

/** Screens that cannot work without a connection show the Offline screen instead. */
const NEEDS_NETWORK: Route['name'][] = ['postJob', 'confirm', 'proposal', 'composer', 'rent', 'verify', 'review'];

function Screen({ route, user }: { route: Route; user: User }) {
  const { state } = useApp();
  switch (route.name) {
    case 'home':
      return user.role === 'client' ? <ClientHome /> : user.role === 'artisan' ? <ArtisanHome /> : <CompanyHome />;
    case 'discover':
      return <Discover category={route.category} />;
    case 'pro':
      return <ProProfile id={route.id} />;
    case 'postJob':
      return <PostJob artisanId={route.artisanId} category={route.category} />;
    case 'jobPosted':
      return <JobPosted jobId={route.jobId} />;
    case 'projects':
      return <Projects />;
    case 'job': {
      const job = state.jobs.find((j) => j.id === route.jobId);
      if (!job) return <Projects />;
      return user.role === 'client' ? <ClientJob job={job} /> : <ArtisanJob job={job} />;
    }
    case 'confirm':
      return <ConfirmProposal jobId={route.jobId} proposalId={route.proposalId} />;
    case 'completed':
      return <Completed jobId={route.jobId} />;
    case 'review':
      return <ReviewForm jobId={route.jobId} />;
    case 'jobs':
      return <ArtisanJobs tab={route.tab} key={route.tab} />;
    case 'proposal':
      return <ProposalForm jobId={route.jobId} kind={route.kind} />;
    case 'applied':
      return <Applied jobId={route.jobId} />;
    case 'verify':
      return <Verify />;
    case 'store':
      return <Store jobId={route.jobId} />;
    case 'rent':
      return <Rent toolId={route.toolId} jobId={route.jobId} />;
    case 'requests':
      return <Requests />;
    case 'tools':
      return <Tools />;
    case 'feed':
      return <Feed />;
    case 'composer':
      return <Composer />;
    case 'comments':
      return <Comments postId={route.postId} />;
    case 'wallet':
      return <Wallet />;
    case 'alerts':
      return <Alerts />;
    case 'me':
      return <Me />;
  }
}

export function App() {
  const { user, route, toastMsg, online } = useApp();
  return (
    <div className="shell">
      <div className="app">
        {!online && <OfflineBanner />}
        <main className="content" key={user?.id ?? 'out'}>
          {!user ? <SignIn /> : !online && NEEDS_NETWORK.includes(route.name) ? <Offline /> : <Screen route={route} user={user} />}
        </main>
        {user && <BottomNav />}
        <div className={'toast' + (toastMsg ? ' show' : '')} role="status" aria-live="polite">
          {toastMsg}
        </div>
      </div>
    </div>
  );
}
