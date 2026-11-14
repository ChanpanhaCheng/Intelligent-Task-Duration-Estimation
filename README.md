# Intelligent Task Duration Estimation

## Overview

Intelligent Task Duration Estimation is a proposed machine learning project and web application for software development teams. It will investigate whether historical issue data can provide useful estimates of how many days individual tasks take to complete. The initial scope covers software development tasks such as bug fixes, features, and improvements.

## Problem Statement

Teams often estimate tasks manually with incomplete information about complexity, dependencies, and prior work. Inconsistent estimates can lead to unrealistic deadlines, scheduling problems, and unexpected delays. Historical task records may help teams plan, provided they contain reliable dates and information available at the time of estimation.

## Project Objectives

- Predict the duration of individual software development tasks from historical examples.
- Compare candidate regressors with an easy-to-interpret historical baseline.
- Help teams plan deadlines and identify tasks that may need extra scheduling attention.
- Use differences between estimated and actual durations to improve future estimates.

## Proposed Features

The first proposed web workflow would let a user enter task details, request an estimate, and see the predicted duration and an estimated completion date when a start date is available. Recording actual duration would let users compare predictions with outcomes. Task editing, priorities, assignment management, history views, and broader scheduling support are additional proposed capabilities for review.

## Dataset and Features

| Proposed field | Role | Description |
| --- | --- | --- |
| Task title | Input | Short summary as recorded when the estimate is requested. |
| Description | Input | Task details available at prediction time. |
| Task type | Input | Category such as bug, feature, or improvement. |
| Priority | Input | Priority at prediction time, such as low, medium, high, or critical. |
| Assignee average completion days | Input | Average duration of tasks the assignee completed before the prediction. Use a historical team-level fallback for new assignees or sparse histories. |
| Actual start date | Conditional input | When work began. Available if the prediction is made at or after task start. |
| Actual completion duration | Target | Days from the actual start to a defined completion event. The rules for calendar versus working days, pauses, and reopened tasks are open decisions. |

A candidate Jira export contains creation and resolution dates but lacks actual start timestamps and recorded assignees. Derived assignee IDs in local copies are synthetic. A creation-to-resolution pilot would measure lead time and would require explicit agreement on the changed target. The proposed start-to-completion target and assignee history require a suitable export. Confirm provenance, permission, field coverage, and usable sample size before choosing a dataset.

## Machine Learning Approach

Compare **Random Forest Regressor**, **Gradient Boosting Regressor**, and **XGBoost Regressor** on the same chronological splits. Train a median-duration baseline using only historical training records available at each cutoff.

Start with tabular features. One proposed text representation is Sentence Transformers' `all-MiniLM-L6-v2`, which converts titles and descriptions into numerical embeddings. The regression model uses those embeddings alongside structured features to predict duration. Compare the same model with and without text to see whether embeddings improve performance. [Model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)

## Proposed Methodology

1. Collect and audit historical issues. Check permission, timestamp coverage, duplicates, reopened issues, missing fields, and changes in tracker usage.
2. Define the prediction moment, completion event, and day-counting rules. Treat unfinished issues as having unobserved completion durations and check whether completed-only sampling underrepresents long tasks.
3. Split records by prediction time into earlier training and validation periods and a later final test period. Use only labels observable at the relevant training cutoff.
4. Fit preprocessing on training data only. Handle missing fields and use only information available when each estimate would have been made. Compute assignee history from tasks completed before that estimate.
5. Train the baseline and candidate regressors. Compare feature sets, then tune promising candidates using earlier validation windows.
6. Evaluate the selected approach and baseline on the untouched final test period. Record data coverage, metrics, and error patterns.
7. Consider retraining when more trustworthy data becomes available. Plan web integration after the evaluation and initial app scope are reviewed.

## Model Evaluation

| Metric | Interpretation |
| --- | --- |
| MAE | Mean absolute error in days. Indicates how far estimates are from observed durations on average. |
| RMSE | Root mean squared error in days. Gives more weight to large errors. |
| R² | Measures fit relative to predicting a constant equal to the mean of the evaluated durations. Lower scores, including negative values, suggest weak fit. |

Use MAE as the proposed primary metric for planning. Report all three metrics for the median baseline and model on the same later test period. Examine errors on long tasks and for new assignees where there are enough examples, and agree on what size of error is useful for planning before relying on the estimates.

## Proposed System Workflow

```mermaid
flowchart LR
    A[User enters task details] --> B[Validate and preprocess available inputs]
    B --> C[Duration regression model]
    C --> D[Display estimated duration]
    D --> E[Show estimated completion date when a start date is available]
```

The completion date would be derived using the selected start date and day-counting rules.

## Technology Stack

**Confirmed:** Git for version control and Markdown for project documentation.

**Under Consideration:** Python for modeling, scikit-learn and XGBoost for candidate regressors, and Sentence Transformers for optional text embeddings. The frontend, backend, database, authentication method, and deployment platform are open for discussion.

## Project Status

**Status: Planning / Repository Initialization**

Model training and application implementation are pending. The features, experiments, and workflow above describe the proposal.

## Future Improvements

Possible extensions include calibrated prediction ranges, historical accuracy reports, monitoring for changing error patterns, task complexity features, and improved coverage from additional historical data. These remain options for later review.

## Research Background

- Sousa et al. (2023), *Applying Machine Learning to Estimate the Effort and Duration of Individual Tasks in Software Projects*, provides context for investigating task-level effort and duration estimation. [Article DOI](https://doi.org/10.1109/ACCESS.2023.3307310)
- Neo et al. (2025), *A Predictive Model for Story Points leveraging features like readability and sentiment from User Story description*, motivates testing whether issue text contains useful estimation signals. Its prediction target is story points, while this project targets elapsed days. [Publisher chapter](https://link.springer.com/chapter/10.1007/978-3-031-98284-2_21)

## Limitations

Incomplete or inconsistent timestamps and limited history can make labels and estimates unreliable. Task complexity, interruptions, scope changes, and differences between teams and developers may be poorly represented in issue records. A model trained on one team's workflow may have larger errors for another team, a new assignee, or an unusual task. Estimates should support planning discussions alongside team judgment.

## Getting Started

Setup instructions will be added after the technology stack and implementation are finalized.
