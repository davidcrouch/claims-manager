 Not sure what the Builder Works fields are? Read Builder Works – Overview & Fields for a more detailed breakdown.

ℹ️ Note: This article outlines the main workflow stages and key automations for this job type.

It is not intended to document every task or automation within the job. The step-by-step guide contains the full process and should be used when completing the job.

Builder Works Workflow
A Builder Works job follows a structured workflow from job allocation through to repair completion and invoicing.

 

The process includes the following stages:

Job allocation

Sending the scope/contract

Collecting excess (if required)

Scheduling the works

Commencing repairs

Completing the repairs

Uploading the completion certificate

Invoicing the Insurer

The diagram below illustrates the flow of a Builder Works job. Click on the image to enter full screen mode. 


Workflow Stages
1. Job Allocation
The Builder Works job is created and allocated to your company once the Builder Assessment quote has been approved.

 

At this stage:

The job appears in your job list, and an email notification is issued to you

Core claim data is automatically populated

The Request Date field is populated

A Purchase Order is created with the approved repair items

Once the job has been received, the next step is to provide the scope and excess invoice (if applicable) to the customer.

 

2. Sending the Scope / Contract
Before repairs can begin, the repair scope/contract must be provided to the customer for review and signature.

 

Automation Trigger

Action

System Behaviour

Send Scope/Contract task completed OR

Job status updated to ‘Awaiting Scope’

Scope Sent Date field is automatically populated

Signed Scope/Contract task completed OR

Job status updated to ‘Scope Signed’

Scope Signed Date field is automatically populated

 
Repairs cannot be scheduled until the scope or contract has been signed by the customer.

 

3. Collecting Excess (If Required)
If the Insurer has indicated that excess must be collected, you must issue the excess invoice to the customer.

 

Automation Trigger

Action

System Behaviour

Send Excess task completed OR

Job status updated to ‘Awaiting Excess’

Excess Sent Date field is automatically populated

Collect Excess task completed OR

Job status updated to ‘Excess Collected’

Excess Collected Date field is automatically populated

Collect Excess task completed OR

Job status updated to ‘Excess Collected’

Excess Payment Collected field is updated

 
Excess must be collected before works commence, if required by the Insurer.

 

4. Scheduling the Works
Once the scope has been signed and excess has been collected (if applicable), repairs can be scheduled.

 

Automation Trigger

Action

System Behaviour

Estimated Start Date AND Estimated Completion Date fields are populated

Works Scheduled Date field is automatically populated

 
5. Commencing Repairs
Once trades have been scheduled and the agreed start date has arrived, repairs can begin.

 

Automation Trigger

Action

System Behaviour

Commence Repairs task completed OR

Job status updated to ‘Repairs in Progress’

Works Commencement Date field is automatically populated

 
Repairs should be completed in line with the agreed repair scope.

 

6. Completing the Repairs
Once all repairs have been completed at the property, the job must be updated to indicate this.

 

Automation Trigger

Action

System Behaviour

Job status updated to ‘Repairs Complete’

Works Completion Date field is automatically populated

 
7. Uploading the Completion Certificate
Once the repairs have been completed, the signed completion certificate must be uploaded to the job, or the customer must verbally indicate that repairs are completed

 

Automation Trigger

Action

System Behaviour

The completion certificate is uploaded

Completion Certificate Upload Date field is automatically populated

 
This confirms that the repair works have been completed.

 

8. Invoicing the Insurer
Once the repairs have been completed and all required documentation has been uploaded, you can submit your invoice to the Insurer.

 

Automation Trigger

Action

System Behaviour

Invoice amount is the same as/below the approved amount

Allows invoice submission

 
Important Notes About Automations
Some fields within the Builder Works job are automatically populated by system automations.

 

These fields include:

Excess Sent Date

Scope Sent Date

Scope Signed Date

Works Scheduled Date

Works Commencement Date

Works Completion Date

Completion Certificate Upload Date

Excess Collected Date

Excess Payment Collected

⚠️ These fields should not be manually edited.

 

They are automatically updated when the corresponding actions are completed in the workflow.

 

Next Steps
To learn how to complete each stage of the process within the system, see: How to Complete a Builder Works Job.

 

This article provides a step-by-step guide for completing a Builder Works job in CIS.

Related Articles
Builder Assessment Job – Workflow & Automations
How to Complete a Builder Assessment Job
Builder Make Safe Job – Workflow & Automations
Builder Works – Overview & Fields
How to Complete a Builder Works Job
