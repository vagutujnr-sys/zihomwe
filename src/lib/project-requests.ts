export type ProjectRequestStatus = "pending" | "reviewing" | "approved" | "rejected" | "completed";

export interface ProjectRequestInput {
  title: string;
  category: string;
  description: string;
  shortDescription?: string;
  projectImageProvided?: boolean;
  requestedAmount: number;
  location: string;
  timeline?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  branch?: string;
  supportingNotes?: string;
}

export interface ProjectRequestTimelineStep {
  label: string;
  complete: boolean;
  active: boolean;
}

export function buildProjectRequestTimeline(status: ProjectRequestStatus): ProjectRequestTimelineStep[] {
  const statusOrder: ProjectRequestStatus[] = ["pending", "reviewing", "approved", "completed"];
  const statusIndex = statusOrder.indexOf(status);

  const steps: ProjectRequestTimelineStep[] = [
    { label: "Submitted", complete: statusIndex >= 0, active: status === "pending" },
    { label: "Review", complete: statusIndex >= 1, active: status === "reviewing" },
    { label: "Approved", complete: statusIndex >= 2, active: status === "approved" },
    { label: "Completed", complete: statusIndex >= 3, active: status === "completed" },
  ];

  if (status === "rejected") {
    return [
      { label: "Submitted", complete: true, active: false },
      { label: "Review", complete: true, active: false },
      { label: "Approved", complete: false, active: false },
      { label: "Completed", complete: false, active: false },
    ];
  }

  return steps;
}

export function validateProjectRequestInput(input: ProjectRequestInput) {
  const errors: string[] = [];

  if (!input.title || input.title.trim().length < 3) {
    errors.push('Project title is required.');
  }

  if (!input.category || input.category.trim().length < 2) {
    errors.push('Project category is required.');
  }

  if (!input.description || input.description.trim().length < 20) {
    errors.push('Please describe the project in at least 20 characters.');
  }

  if (input.shortDescription !== undefined && input.shortDescription.trim().length < 10) {
    errors.push('Please provide a short project description of at least 10 characters.');
  }

  if (input.projectImageProvided === false) {
    errors.push('Please upload a project image before submitting.');
  }

  if (!Number.isFinite(input.requestedAmount) || input.requestedAmount <= 0) {
    errors.push('Requested amount must be greater than zero.');
  }

  if (!input.location || input.location.trim().length < 2) {
    errors.push('Project location is required.');
  }

  if (input.bankName && input.bankName.trim().length < 2) {
    errors.push('Bank name is invalid.');
  }

  if (input.accountName && input.accountName.trim().length < 2) {
    errors.push('Account name is invalid.');
  }

  if (input.accountNumber && (!/^\d{8,20}$/.test(input.accountNumber.trim()))) {
    errors.push('Bank account number must contain 8 to 20 digits.');
  }

  if (input.branch && input.branch.trim().length < 2) {
    errors.push('Branch name is invalid.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
