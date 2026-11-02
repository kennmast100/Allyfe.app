import { useState } from 'react';
import { BottomNav, dayLabel } from './components/ui';
import { Icon } from './components/art';
import { useApp, type Route } from './store/store';
import type { User } from './domain/types';
import { Applied, ArtisanHome, ArtisanJob, ArtisanJobs, ProfileEdit, QuoteForm, Rent, Store, Verify, useStartDayJobs } from './screens/artisan';
import { BidReview, ClientHome, ClientJob, Discover, JobPosted, PostJob, ProProfile, Projects, RateJob } from './screens/client';
import { CompanyHome, Requests, Tools } from './screens/company';
import { OrderDetail, Orders, VendorHome } from './screens/vendor';
import { Alerts, Comments, Composer, Feed, Me, Offline, OfflineBanner, SignIn, Terms, Wallet } from './screens/shared';

/** Screens that cannot work without a connection show the Offline screen instead. */
const NEEDS_NETWORK: Route['name'][] = ['postJob', 'bid', 'quote', 'composer', 'rent', 'verify', 'rate', 'order', 'profileEdit'];

function Screen({ route, user }: { route: Route; user: User }) {
  const { state } = useApp();
  switch (route.name) {
    case 'home':
      return user.role === 'client' ? <ClientHome /> : user.role === 'artisan' ? <ArtisanHome /> : user.role === 'vendor' ? <VendorHome /> : <CompanyHome />;
    case 'discover':
      return <Discover category={route.category} />;
    case 'pro':
      return <ProProfile id={route.id} />;
    case 'postJob':
      return <PostJob artisanId={route.artisanId} category={route.category} key={(route.artisanId ?? '') + (route.category ?? '')} />;
    case 'jobPosted':
      return <JobPosted jobId={route.jobId} />;
    case 'projects':
      return <Projects />;
    case 'job': {
      const job = state.jobs.find((j) => j.id === route.jobId);
      if (!job) return <Projects />;
      if (user.role === 'vendor') return <OrderDetail jobId={job.id} />;
      return user.role === 'client' ? <ClientJob job={job} /> : <ArtisanJob job={job} />;
    }
    case 'bid':
      return <BidReview jobId={route.jobId} bidId={route.bidId} />;
    case 'rate':
      return <RateJob jobId={route.jobId} />;
    case 'jobs':
      return <ArtisanJobs tab={route.tab} key={route.tab} />;
    case 'quote':
      return <QuoteForm jobId={route.jobId} />;
    case 'applied':
      return <Applied jobId={route.jobId} />;
    case 'verify':
      return <Verify />;
    case 'profileEdit':
      return <ProfileEdit />;
    case 'store':
      return <Store jobId={route.jobId} />;
    case 'rent':
      return <Rent toolId={route.toolId} jobId={route.jobId} />;
    case 'requests':
      return <Requests />;
    case 'tools':
      return <Tools />;
    case 'orders':
      return <Orders tab={route.tab} key={route.tab} />;
    case 'order':
      return <OrderDetail jobId={route.jobId} />;
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
    case 'terms':
      return <Terms />;
    case 'me':
      return <Me />;
  }
}

/** On the scheduled day the app pops up the job so the artisan can tap Work started. */
function StartDayPopup() {
  const { go, dispatch, route } = useApp();
  const jobs = useStartDayJobs();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const j = jobs.find((x) => !dismissed.includes(x.id));
  if (!j || (route.name === 'job' && route.jobId === j.id)) return null;
  const close = () => setDismissed([...dismissed, j.id]);
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="sd-title">
      <div className="modal">
        <span className="success-ic sm">
          <Icon name="cal" size={30} />
        </span>
        <h2 id="sd-title">Today is your start day</h2>
        <p className="sub">
          <b>{j.title}</b>
          <br />
          {dayLabel(j.scheduledDay!)} · {j.addr}
          <br />
          The materials are at the client's home.
        </p>
        <button
          className="btn primary"
          onClick={() => {
            if (dispatch({ type: 'startWork', jobId: j.id }, 'The client has been told you started.')) go({ name: 'job', jobId: j.id });
            close();
          }}
        >
          Work started
        </button>
        <button
          className="btn secondary mt8"
          onClick={() => {
            close();
            go({ name: 'job', jobId: j.id });
          }}
        >
          View job
        </button>
        <button className="link small mt10" onClick={close}>
          Not yet
        </button>
      </div>
    </div>
  );
}

export function App() {
  const { user, route, toastMsg, online, env } = useApp();
  return (
    <div className="shell">
      <div className="app">
        {!online && <OfflineBanner />}
        {env !== 'local' && env !== 'production' && <div className="env-badge">{env.toUpperCase()}</div>}
        <main className="content" key={user?.id ?? 'out'}>
          {!user ? <SignIn /> : !online && NEEDS_NETWORK.includes(route.name) ? <Offline /> : <Screen route={route} user={user} />}
        </main>
        {user && <BottomNav />}
        {user?.role === 'artisan' && online && <StartDayPopup />}
        <div className={'toast' + (toastMsg ? ' show' : '')} role="status" aria-live="polite">
          {toastMsg}
        </div>
      </div>
    </div>
  );
}
