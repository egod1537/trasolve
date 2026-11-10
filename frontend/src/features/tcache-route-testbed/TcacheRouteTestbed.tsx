import { useTcacheTestbed } from '@/features/tcache-route-testbed/model/useTcacheTestbed';
import { Classes } from '@blueprintjs/core';

import { AppHeader } from '@/features/tcache-route-testbed/components/AppHeader';
import { CancelJobDialog } from '@/features/tcache-route-testbed/components/detail/CancelJobDialog';
import { JobDetail } from '@/features/tcache-route-testbed/components/detail/JobDetail';
import { JobSidebar } from '@/features/tcache-route-testbed/components/jobs/JobSidebar';
import { TcacheJobBuilderDialog } from '@/features/tcache-route-testbed/job-builder/TcacheJobBuilderDialog';

import '@blueprintjs/core/lib/css/blueprint.css';
import '@/features/tcache-route-testbed/tcache-route-testbed.css';

export function TcacheRouteTestbed() {
  const {
    themeMode,
    resolvedTheme,
    setThemeMode,
    health,
    jobs,
    selectedJobId,
    setSelectedJobId,
    refreshing,
    listError,
    builderOpen,
    setBuilderOpen,
    builderError,
    setBuilderError,
    submitting,
    cancelJobId,
    setCancelJobId,
    cancelling,
    selectedJob,
    visibleStreamState,
    refreshHealth,
    refreshJobs,
    createJob,
    confirmCancel,
  } = useTcacheTestbed();
  return (
    <div
      className={`tcache-testbed-shell ${resolvedTheme === 'dark' ? Classes.DARK : ''}`}
      data-theme={resolvedTheme}
    >
      <AppHeader
        health={health}
        themeMode={themeMode}
        onRefresh={() => {
          void refreshHealth();
          void refreshJobs();
        }}
        onThemeChange={setThemeMode}
      />
      <main className="tcache-job-workspace">
        <JobSidebar
          jobs={jobs}
          selectedJobId={selectedJobId}
          refreshing={refreshing}
          error={listError}
          onNewJob={() => {
            setBuilderError(null);
            setBuilderOpen(true);
          }}
          onRefresh={() => void refreshJobs()}
          onSelect={setSelectedJobId}
        />
        <JobDetail
          job={selectedJob}
          streamState={visibleStreamState}
          cancelling={cancelling}
          onRequestCancel={setCancelJobId}
        />
      </main>
      <TcacheJobBuilderDialog
        isOpen={builderOpen}
        dark={resolvedTheme === 'dark'}
        submitting={submitting}
        error={builderError}
        onClose={() => {
          if (!submitting) {
            setBuilderOpen(false);
          }
        }}
        onCreate={(request) => void createJob(request)}
      />
      <CancelJobDialog
        jobId={cancelJobId}
        loading={cancelling}
        dark={resolvedTheme === 'dark'}
        onClose={() => {
          if (!cancelling) {
            setCancelJobId(null);
          }
        }}
        onConfirm={() => void confirmCancel()}
      />
    </div>
  );
}
