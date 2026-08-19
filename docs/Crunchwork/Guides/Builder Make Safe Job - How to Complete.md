Quick Process Summary
Builder Make Safe jobs typically follow this process:

 

Allocated → Contact Customer → Schedule Attendance → Attend Property → Submit Make Safe Quote → Quote Approved → PO Created → Invoice Submitted → Job Complete

 

This guide explains each step required to complete the job within Crunchwork

 

Step-by-Step Process
1. Receive the Job Allocation
When an Insurer allocates a Builder Make Safe job to your company:

The job status is set to Allocated

You will receive an allocation email notification

A Call to Schedule task will be open on the job

The Claim Recommendation field will be automatically populated as Accept

Before proceeding, ensure you review the job information.

 

Examples of What to Check
Risk address

Job instructions

Customer contact details

Priority


Example of a newly allocated Builder Make Safe job.

 

2. Contact the Customer
The next step is to contact the customer to arrange a make safe attendance.

Once the customer has been contacted, the Call to Schedule task must be completed.

 

Automation Trigger

Action

System Behaviour

Call to Schedule task is completed

Contact Date field is populated

Call to Schedule task is completed

Attendance Due Date is calculated based on insurer SLA

Call to Schedule task is completed

Book Site Attendance task is created

 
If the Call to Schedule task is failed, the system will automatically create a Call to Schedule #2 task for follow-up.


Call to Schedule task

💡 Need help actioning a task? See Completing a Task for instructions on how to action tasks within Crunchwork.

3. Schedule the Site Attendance
Once the appointment has been arranged with the customer, schedule the attendance within Crunchwork.

Scheduling the appointment will:

Complete the Book Site Attendance task

Populate the Booked Date field

Populate the Attendance Date field

Update the job status to Scheduled

Automation Trigger

Action

System Behaviour

Appointment is scheduled

Book Site Attendance task is completed

Appointment is scheduled

Booked Date field is populated

Appointment is scheduled

Attendance Date field is populated

Appointment is scheduled

Job status updates to Scheduled

 
Scheduled appointment

💡 Need help scheduling an appointment? See How to Create & View an Appointment for instructions on how to schedule an appointment within a job.

‼️ Important

If the appointment is scheduled before completing the Call to Schedule task, the system will automatically:

Complete the Call to Schedule task

Populate the Contact Date

Trigger the associated automations.

4. Attend the Property
Attend the property at the scheduled time to complete the required make safe works.

Make safe works may include:

Temporary roof protection

Boarding windows or doors

Securing unsafe building elements

Temporary weatherproofing

Once the Attendance Date passes, the system will automatically:

Update the job status to Awaiting Submission

Create a Submission Required task

Automation Trigger

Action

System Behaviour

Attendance Date passes

Job status updates to Awaiting Submission

Attendance Date passes

Submission Required task is created

 

Example of a Builder Make Safe job moved to Awaiting Submission once the Attendance Date passed

If a Make Safe is not Required
During the inspection, you may identify that the property does not require temporary works to make it safe.

You can cancel your Make Safe job directly

To do this:

Locate the Make Safe Required field on the job.

Change the value to No.

When this field is set to No:

The Make Safe job will be automatically update to Cancelled

5. Submit the Make Safe Quote
Once the make safe works are completed, the quote must be submitted.

To do this:

Upload the Make Safe report (if required by the Insurer)

Create the Make Safe quote

Publish the quote

Once the quote is published:

The job status will update to Awaiting Review

Automation Trigger

Action

System Behaviour

Quote is published

Job status updates to Awaiting Review

 

Example of a published Quote

💡 Need help creating or publishing a quote? See Quotes for instructions on creating and publishing quotes.

6. Quote Review Outcome
Once the quote is published, the outcome will depend on the Insurer’s approval rules.

 

Scenario 1 — Auto Approval Applies
If the quote meets the Insurer’s auto-approval criteria:

The quote status updates to Approved

A Purchase Order (PO) is created

The PO will contain line items from the approved quote

‼️ Important

A Builder Make Safe Quote will be auto-approved if, at the time of publishing, the following was true:

Claim Recommendation field = Accept

Auto-Approval Applies = Yes

Claim Decision = Accept

Quote value is the same as/below the delegate authority limit the Insurer has set for you in Crunchwork

Scenario 2 — Insurer Review Required
If the quote does not meet auto-approval criteria:

The quote will remain Published

The Insurer will be notified for review

Possible Quote Outcomes
Quote Status

Result

Approved

A Purchase Order (PO) is created

Vendor receives outcome email

Resubmission Required

Job status updates to Awaiting Resubmission and a new Submission Required task is created

Vendor receives outcome email

Cash Settled

Vendor receives outcome email

Declined

Vendor receives outcome email

Cancelled

Vendor receives outcome email

 
If Resubmission Required, the vendor must:

Revise the quote

Publish the new quote revision

💡 Need help revising or resubmitting a quote? See How to Revise a Quote.

7. Record Make Safe Completion
Once the make safe works are finished, you must record the completion.

Populate the Completed Date field with the date the make safe works were completed.

 

8. Submit Your Invoice
Once the Purchase Order has been created, you can submit your invoice.

Invoices must meet the following criteria:

Invoice amount must be equal to or less than the remaining PO value.

💡 Need help submitting an invoice? See How to Submit an Invoice in Crunchwork.

9. Make Safe Variations (Additional Costs)
If additional make safe costs are incurred after the initial quote:

Create a Make Safe variation quote

Submit and publish the quote

Wait for Insurer approval

Once approved:

The new quote items will be added to the existing Purchase Order

ℹ️ Note: Only one Purchase Order exists per Make Safe job.

💡 Need help creating and publishing a variation? See How to Create a Variation.

10. Purchase Order Completion
Once invoices are approved:

The system tracks the total approved invoice value

When the total approved invoices equals the PO value:

The Purchase Order automatically updates to Completed


Example of a completed Purchase Order

 

11. Job Completion
Once the following conditions are met:

A quote has been published

The Purchase Order is completed

The system will automatically:

Update the job status to Complete

Once a Builder Make Safe job is completed, the fields will become read-only.


Example of a completed Builder Make Safe job

 

Common Mistakes
⚠️ Forgetting to publish the quote

Creating the quote is not enough - it must be published.

⚠️ Not recording the Completed Date

The Completed Date must be entered once make safe works are finished.

Next Steps
Once the make safe works have been completed, the quote has been approved, and the Purchase Order has been fully invoiced, the Builder Make Safe job will update to Complete.

 

Builder Make Safe jobs are standalone jobs. Where required, they may be completed in conjunction with other jobs.

 

To understand the high-level workflows for this job type, see: Builder Make Safe – Workflow & Automations.

Related Articles
Builder Assessment Job – Workflow & Automations
How to Complete a Builder Assessment Job
Builder Make Safe – Overview & Fields
Builder Make Safe Job – Workflow & Automations
How to Complete a Builder Works Job
