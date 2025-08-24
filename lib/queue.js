// lib/queue.js
class MigrationQueue {
  constructor() {
    this.jobs = new Map();
    this.processing = false;
  }

  addJob(jobId, jobData) {
    this.jobs.set(jobId, {
      ...jobData,
      status: "pending",
      createdAt: new Date(),
      attempts: 0,
    });
    this.processQueue();
  }

  async processQueue() {
    if (this.processing) return;

    this.processing = true;
    for (const [jobId, job] of this.jobs) {
      if (job.status === "pending" && job.attempts < 3) {
        try {
          job.status = "processing";
          job.attempts++;

          // Process the job based on its type
          await this.processJob(jobId, job);

          job.status = "completed";
          this.jobs.delete(jobId);
        } catch (error) {
          job.status = "failed";
          job.error = error.message;
          console.error(`Job ${jobId} failed:`, error);
        }
      }
    }
    this.processing = false;
  }

  async processJob(jobId, job) {
    switch (job.type) {
      case "create-inventory-adjustment":
        await processInventoryAdjustment(job.data);
        break;
      case "create-lot-mappings":
        await processLotMappings(job.data);
        break;
      // Add other job types as needed
    }
  }

  getJobStatus(jobId) {
    return this.jobs.get(jobId) || { status: "not-found" };
  }
}

export const migrationQueue = new MigrationQueue();
