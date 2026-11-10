import { useTrouteTestbed } from '@/features/troute-testbed/model/useTrouteTestbed';
import { Classes } from '@blueprintjs/core';

import { lazy, Suspense } from 'react';

import { RenderProfiler } from '@/shared/lib/RenderProfiler';
import { AppHeader } from '@/features/troute-testbed/components/AppHeader';
import { CancelJobDialog } from '@/features/troute-testbed/components/detail/CancelJobDialog';
import { JobDetail } from '@/features/troute-testbed/components/detail/JobDetail';
import { JobSidebar } from '@/features/troute-testbed/components/jobs/JobSidebar';

import '@blueprintjs/core/lib/css/blueprint.css';
import '@/features/troute-testbed/troute-test.css';

const JobBuilderDialog = lazy(() =>
  import('@/features/troute-testbed/job-builder/JobBuilderDialog').then(
    (module) => ({
      default: module.JobBuilderDialog,
    }),
  ),
);

export default function TrouteTestbed() {
  const {
    themeMode,
    resolvedTheme,
    setThemeMode,
    health,
    jobs,
    selectedJobId,
    setSelectedJobId,
    newJobOpen,
    cancelDialogJobId,
    setCancelDialogJobId,
    cancellingJobId,
    jobListPolling,
    handleRefreshHealth,
    selectedJob,
    jobEventStream,
    existingJobIds,
    createJob,
    openJobBuilder,
    closeJobBuilder,
    refreshJobs,
    closeCancelDialog,
    confirmCancelJob,
  } = useTrouteTestbed();
  return (
    <div
      className={`app-shell troute-testbed-shell ${resolvedTheme === 'dark' ? Classes.DARK : ''}`}
      data-theme={resolvedTheme}
    >
      <AppHeader
        health={health}
        themeMode={themeMode}
        onRefreshHealth={handleRefreshHealth}
        onThemeChange={setThemeMode}
      />

      <main className="job-workspace">
        <RenderProfiler id="troute-job-list">
          <JobSidebar
            jobs={jobs}
            selectedJobId={selectedJobId}
            refreshing={jobListPolling.loading}
            onNewJob={openJobBuilder}
            onRefresh={refreshJobs}
            onSelect={setSelectedJobId}
          />
        </RenderProfiler>
        <RenderProfiler id="troute-job-detail">
          <JobDetail
            job={selectedJob}
            cancelling={selectedJob?.id === cancellingJobId}
            streamStatus={jobEventStream.status}
            streamError={jobEventStream.error}
            onRequestCancel={setCancelDialogJobId}
          />
        </RenderProfiler>
      </main>

      <CancelJobDialog
        isOpen={cancelDialogJobId !== null}
        loading={cancelDialogJobId === cancellingJobId}
        dark={resolvedTheme === 'dark'}
        onCancel={closeCancelDialog}
        onConfirm={confirmCancelJob}
      />

      {newJobOpen ? (
        <Suspense fallback={null}>
          <JobBuilderDialog
            isOpen
            dark={resolvedTheme === 'dark'}
            existingJobIds={existingJobIds}
            onClose={closeJobBuilder}
            onCreate={createJob}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
