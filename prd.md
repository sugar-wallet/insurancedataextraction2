ZRC v3.1 — Zero-Friction Requirements Companion  (✓ = locked, ~ = open)
Instructions

⁠  ⁠Fill in or edit the blank cells under each table.
⁠  ⁠Flip the leading symbol in the ✓/~ column from ⁠ ~ ⁠ → ⁠ ✓ ⁠ when the line is agreed.
⁠  ⁠If the requirement comes directly from the user set it to ⁠ ✓ ⁠.
⁠  ⁠Use the Note column for capturing context-sufficient nuance, edge cases, potentially impactful information, rationale, or follow-ups (optional).
⁠  ⁠Notes should capture enough context that new clarifications, due to insufficient context, will not mistakenly repeat old conversations.
⁠  ⁠Always return the entire file each turn so locks stay intact.
⁠  ⁠Ask essential clarifying questions that help represent exactly what the user has in mind.
⁠  ⁠Clarifying questions should be easy to answer and are critical, non-trivial decisions that will impact the success of the implementation.
⁠  ⁠This spec's purpose is to ensure seamless and bug-free implementation by AI.
⁠  ⁠Choose boring but simple solutions over complex solutions.
⁠  ⁠Distinguished engineer quality outputs.
⁠  ⁠There are 2 phases, clarification phase and implementation phase. Do one or the other as the user requests, not both.
⁠  ⁠Concrete examples where possible.
⁠  ⁠Stick to chat only, never respond with the canvas tool.


Goal
Build an internal web tool that extracts data from insurance policy PDFs using AI, categorizes fields as known/unknown, and generates downloadable questionnaires for missing information.

Extra context: Time-saving and accuracy are primary drivers
Core focus: Enable staff to quickly process policies and gather missing client information


Facts / Decisions
✓/~StatementNote✓Tool is for internal use onlyNo external user authentication needed✓Web app architectureAccessible via browser✓Standalone system for MVPNo integrations with existing systems✓Process one PDF at a timeBut many throughout the day✓Support all insurance types (auto, home, life, health, commercial)Different question sets per type✓Multiple insurance carriers supportedMust handle varying PDF formats✓Use AI model (Gemini or similar) for every extractionFresh AI processing each time, no cached extractions✓Extract typed text only for MVPNo OCR/handwritten text support✓English language only for MVPMulti-language support deferred✓Store extracted data as JSONDisplay in user-friendly web UI✓Generate plain text questionnaire downloadsSimple format for client communication✓Users can review/edit extracted data before generating questionsManual verification step✓System learns from corrections to improve future extractionsStore successful extractions as training data✓No user authentication for MVPAll users have full access✓No compliance/security requirements for MVPCan be added later✓Define specific "known" vs "unknown" field categoriesMock unknowns: excess, premium, car value, address, DOB, windshield coverage, accident history, modifications. Focus on vehicle, house, contents, life, health insurance.✓AI model integration approach (API key management, rate limits)Use Gemini with provided API key: AIzaSyB-3qynn5lSKcnG6nkww3BLNv_Cdpi7M7Q✓Error handling for failed extractionsProvide both options: manual data entry form AND retry with different PDF✓File size limits for PDFsMaximum 10MB per upload✓Data persistence approachUser-triggered deletion only; no automatic expiration

MVP Implementation Plan
✓/~StepNote✓Set up web app skeleton (React frontend, Node.js backend)Basic project structure with build tools✓Implement PDF upload endpoint with file validationAccept PDF, check format, enforce 10MB limit✓Integrate AI model API for data extractionConnect to Gemini using provided API key, handle auth and rate limits✓Create data extraction parser and field categorization logicProcess AI response, map to predefined field templates per insurance type✓Build review/edit UI for extracted dataEditable form with field validation, show confidence scores✓Implement question generation engineTemplate system for missing fields by insurance type (vehicle, house, contents, life, health)✓Add plain text download functionalityFormat questionnaire with policy reference info✓Create learning mechanism from user correctionsStore verified extractions in JSON for pattern improvement✓Add error handling with dual recovery optionsManual entry form + retry upload for failed extractions✓Deploy to internal hosting environmentDocker container for easy Mac deployment