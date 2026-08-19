⚠️ The content of this article is Confidential - it is not to be shared.

If you are looking for an overview of the job fields or workflow, see:

Builder Works – Overview & Fields

Builder Works – Workflow & Automations

Quick Process Summary
Builder Works jobs typically follow this process:

 

Allocated → Send Scope → Scope Signed → Collect Excess (if required) → Schedule Repairs → Repairs Commence → Repairs Complete → Upload Completion Certificate → Invoice Submitted → Job Complete

 

This guide explains each step required to complete the job within Crunchwork

 

Step-by-Step Process
1. Receive the Job Allocation
A Builder Works job is created when the Builder Assessment quote is approved.

When the job is allocated:

The vendor receives an allocation email

Job Status = Allocated

A Purchase Order (PO) is created containing the approved items from the Builder Assessment quote

The Claim Recommendation field is populated with the value from the Builder Assessment job

The following tasks are also created:

Repair Update task (recurring)

Send Scope / Contract task

Send Excess task (if excess is required)


Example of a newly allocated Builder Works job.

 

2. Provide Repair Updates
A Repair Update task is created on the job and will continue to re-generate every 5 business days until the repairs are complete.

 

The task can be completed in multiple ways.

 

Automation Trigger

Action

System Behaviour

Repair Update task completed

New Repair Update task created with due date 5 business days later

Repair Update message sent

Repair Update task completed AND New Repair Update task created with due date 5 business days later

Job status updated (either manually or by automation)

Repair Update task completed AND New Repair Update task created with due date 5 business days later

 
This ensures the Insurer receives regular progress updates throughout the repair process.


Repair Update task

💡 Need help sending messages? See Sending Messages in Crunchwork.

💡 Need help actioning a task? See Completing a Task for instructions on how to action tasks within Crunchwork.

 

3. Send the Scope / Contract
Once the repair scope has been prepared and sent to the customer (off-platform), it must be recorded in the job.

There are two ways to record this action.

 

Option 1 — Complete the Task
Complete the Send Scope / Contract task

 

Option 2 — Update Job Status
Update Job Status → Awaiting Scope

 

Both actions will:

Populate Scope Sent Date

Update Job status to Awaiting Scope

Complete Send Scope / Contract task

Create Signed Scope Contract task


Send Scope/Contract Task

 

4. Send Excess Invoice (If Required)
If the Insurer has indicated excess must be collected, the Send Excess task must be completed after sending the invoice to the customer (off-platform).

 

There are two ways to record this.

 

Option 1 — Complete the Task
Complete Send Excess task

 

Option 2 — Update Job Status
Update Job Status → Awaiting Excess

 

Both actions will:

Populate Excess Sent Date

Update Job status to Awaiting Excess

Complete Send Excess task

Create Collect Excess task


Send Excess Task

⚠️ This step only occurs if the Insurer requires excess to be collected.

5. Record Signed Scope
Once the customer signs and returns the scope (off-platform), it must be recorded in the job.

 

There are three ways to record this.

 

Option 1 — Update Job Status
Update Job Status → Scope Signed

 

Option 2 — Populate Scope Signed Date
Populate Scope Signed Date field

 

Option 3 — Complete Task
Complete Signed Scope / Contract task

 

All three actions will:

Populate Scope Signed Date

Complete Signed Scope Contract task

Update Job Status → Scope Signed


Signed Scope Contract task

 

6. Collect Excess (If Required)
Once the customer pays the excess, the payment must be recorded.

There are three ways to record excess collection.

 

Option 1 — Populate Collect Excess Payment Field
Populate Collect Excess Payment field

 

Option 2 — Complete Collect Excess Task
Complete Collect Excess task

 

Option 3 — Update Job Status
Update Job Status → Excess Collected

 

All three actions will:

Populate Excess Collected Date

Populate Collect Excess Payment field

Complete Collect Excess task

Update Job Status → Excess Collected


Collect Excess task

7. Schedule Repairs
Once the following are completed:

Signed Scope / Contract task

Collect Excess task (if applicable)

The system will create a Schedule Repairs task.

 

To schedule repairs:

Populate Estimated Start Date

Populate Estimated Completion Date

Once both fields are populated:

 

Automation Trigger

Action

System Behaviour

Estimated Start + Completion Dates entered

Job Status updates to Scheduled

Job Status Scheduled

Schedule Repairs task completed

Job Status Scheduled

Works Scheduled Date populated

Job Status Scheduled

Commence Repairs task created

 

Estimated Start Date and Estimated Completion Date fields

 

8. Commence Repairs
Once trades begin work at the property, repairs must be recorded as commenced.

There are two ways to record this.

 

Option 1 — Complete Task
Complete Commence Repairs task

 

Option 2 — Update Job Status
Update Job Status → Repairs In Progress

 

Both actions will:

Populate Works Commencement Date

Complete Commence Repairs task

Update Job status to Repairs In Progress

Once repairs commence:

An Upload Completion Certificate task is created.


Example of a Builder Works job in Repairs in Progress status

 

9. Complete Repairs
Once repairs are finished:

 

Update Job Status → Repairs Complete

 

Then confirm the customer has signed off on completion in one of the following ways.

 

Option 1 — Upload Completion Certificate
Upload the signed completion certificate using Document Type: Completion Certificate

 

This will:

Populate Completion Certificate Upload Date

Complete Upload Completion Certificate task

Option 2 — Record Verbal Completion
If the customer provided verbal confirmation only:

 

Populate Date Customer Confirmed Completion

 

This will:

Complete Upload Completion Certificate task


Example of uploading a Completion Certificate document


Example of the Date Customer Confirmed Completion field

💡 Need help uploading documents? See Uploading Attachments.

10. Submit Your Invoice
To invoice for the works, upload your invoice against the Purchase Order.

Invoices must meet the following conditions:

Invoice amount must be equal to or less than the remaining PO value

If excess was required:

The PO will display a Total Minus Excess value

This is the amount the vendor should invoice for.


Example of a Builder Works Purchase Order with a Total Minus Excess value

 

11. Works Variations
If additional works are required beyond the original quote:

Create a variation quote on the Builder Works job

Submit and publish the variation

Wait for Insurer approval

Once approved:

The approved variation items will be added to the existing Purchase Order

Note: Only one Purchase Order exists per Builder Works job.

 

12. Purchase Order Completion
The system tracks the total approved invoice value.

 

When the total approved invoices equals the PO value:

The Purchase Order automatically updates to Completed

13. Job Completion
Once the following conditions are met:

The Purchase Order is Completed

The Completion Certificate is uploaded (or completion confirmed)

The system will automatically update the job status to Job Complete.

 

Common Mistakes
⚠️ Forgetting to publish variation quotes

Additional costs must be submitted through a variation quote to be able to invoice for them. This includes when negative variations are required.

 

Next Steps
Once the repairs have been completed, a completion certificate has been provided and the Purchase Order has been fully invoiced, the Builder Works job will update to Job Complete.

 

This is typically the last job you are required to complete.

 

To understand the high-level workflows for this job type, see: Builder Works – Workflow & Automations.

Related Articles
Builder Assessment – Overview & Fields
How to Complete a Builder Assessment Job
How to Complete a Builder Make Safe Job
Builder Works – Overview & Fields
Builder Works Job – Workflow & Automations
