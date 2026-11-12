use crate::model::{basename, now, Failure, Job, Progress};

#[derive(Default)]
pub struct Queue {
    pub jobs: Vec<Job>,
    serial: u64,
}
impl Queue {
    pub fn has_input(&self, input: &str) -> bool {
        self.jobs
            .iter()
            .any(|j| j.active() && j.input.eq_ignore_ascii_case(input))
    }
    pub fn enqueue(&mut self, input: String, target: String, directory: Option<String>) -> bool {
        if self
            .jobs
            .iter()
            .any(|j| j.active() && j.input.eq_ignore_ascii_case(&input) && j.target == target)
        {
            return false;
        }
        self.serial += 1;
        self.jobs.push(Job {
            id: self.serial,
            input,
            target,
            status: "queued".into(),
            phase: "preparing".into(),
            started_at: 0,
            output: None,
            error: None,
            output_directory: directory,
        });
        true
    }
    pub fn next(&mut self) -> Option<Job> {
        let job = self.jobs.iter_mut().find(|j| j.status == "queued")?;
        job.status = "running".into();
        job.started_at = now();
        Some(job.clone())
    }
    pub fn failures(&self) -> Vec<&Job> {
        self.jobs
            .iter()
            .filter(|j| {
                j.status == "error"
                    && !self.jobs.iter().any(|n| {
                        n.id > j.id
                            && n.input.eq_ignore_ascii_case(&j.input)
                            && n.target == j.target
                    })
            })
            .collect()
    }
    pub fn progress(&self, changed: &Job) -> Progress {
        let visible = self
            .jobs
            .iter()
            .find(|j| j.status == "running")
            .unwrap_or(changed);
        let failures = self.failures();
        Progress {
            job: visible.clone(),
            name: basename(&visible.input),
            queued: self.jobs.iter().filter(|j| j.status == "queued").count(),
            completed: self.jobs.iter().filter(|j| j.status == "success").count(),
            failures: failures
                .iter()
                .skip(failures.len().saturating_sub(3))
                .map(|j| Failure {
                    name: basename(&j.input),
                    error: j
                        .error
                        .clone()
                        .unwrap_or_else(|| "Chuyển đổi không thành công.".into()),
                })
                .collect(),
        }
    }
    pub fn prune(&mut self) {
        while self.jobs.len() > 50 && !self.jobs[0].active() {
            self.jobs.remove(0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn serial_queue_deduplicates_and_snapshots_retry_destination() {
        let mut q = Queue::default();
        assert!(q.enqueue(
            "C:\\report.docx".into(),
            "pdf".into(),
            Some("C:\\old".into())
        ));
        assert!(!q.enqueue(
            "c:\\REPORT.docx".into(),
            "pdf".into(),
            Some("C:\\new".into())
        ));
        let first = q.next().unwrap();
        q.enqueue("C:\\second.docx".into(), "pdf".into(), None);
        let progress = q.progress(&q.jobs[1]);
        assert_eq!(progress.job.id, first.id);
        assert_eq!(progress.queued, 1);
        q.jobs[0].status = "error".into();
        let retry = (**q.failures().last().unwrap()).clone();
        q.enqueue(retry.input, retry.target, retry.output_directory);
        assert!(q.failures().is_empty());
        assert_eq!(q.jobs[2].output_directory.as_deref(), Some("C:\\old"));
        assert_eq!(q.next().unwrap().input, "C:\\second.docx");
    }
}
