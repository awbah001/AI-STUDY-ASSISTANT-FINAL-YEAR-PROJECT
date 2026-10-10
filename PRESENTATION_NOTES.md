# Understanding Websites, Web Applications, Web Portals, and Mobile Applications

## Presentation guide

**Case study:** Course-Specific AI Learning Assistant  
**Audience:** Beginners and students learning software concepts  
**Suggested duration:** 15–20 minutes, including a short demonstration  
**Presenter:** [Your name]  
**Institution / course:** [Your institution or course]  
**Date:** [Presentation date]

Each slide contains short **on-slide content**, fuller **speaker notes**, and a **visual suggestion**. Copy the on-slide content into PowerPoint, Google Slides, or Canva. Put the speaker notes in the presentation's notes area rather than on the slide itself.

Project examples are based on the repository documentation and source structure. The demonstration plan is a suggested walkthrough, not a claim that the application was run or tested while preparing these notes.

---

## Slide 1 — Title

### On-slide content

**Understanding Websites, Web Apps, Web Portals, and Mobile Apps**

Using the Course-Specific AI Learning Assistant as a case study

Presented by: [Your name]

### Speaker notes

Good [morning/afternoon]. Today I will explain four terms we often hear when discussing digital systems: website, web application, web portal, and mobile application.

I will use our Course-Specific AI Learning Assistant to make these ideas practical. This system helps students study with course materials, AI assistance, flashcards, and quizzes. It also gives lecturers and administrators tools for managing learning activities and the platform.

One system can demonstrate several of these concepts because the terms describe different aspects of a digital product.

### Visual suggestion

Place a browser screenshot and a mobile app screenshot side by side.

---

## Slide 2 — Learning objectives

### On-slide content

By the end, you should be able to:

- Define each of the four terms.
- Explain their main differences and overlaps.
- Identify examples within our learning system.
- Explain how the web and mobile interfaces share services.

### Speaker notes

The aim is to understand the purpose of each term, rather than memorize four disconnected definitions.

We will ask three questions: How does the user access the system? What can the user do? How are information and services organized for that user?

These questions help us see why the browser version of our learning system can be described as both a web application and a web portal.

### Visual suggestion

Use four simple labeled icons: Website, Web App, Web Portal, and Mobile App.

---

## Slide 3 — Introducing the case study

### On-slide content

**Course-Specific AI Learning Assistant**

- Students: study materials, AI tutor, quizzes, and flashcards.
- Lecturers: courses, assessments, students, and announcements.
- Administrators: users, academic management, and system operations.
- Access through a web browser or a dedicated mobile app.

### Speaker notes

Our project is a learning platform with three main user roles.

Students use it to access learning resources and carry out study activities. Lecturers use it to organize teaching activities and manage course-related work. Administrators manage accounts and platform operations.

The project includes a public homepage, browser-based workspaces, and a separate mobile application. The web and mobile interfaces connect to a shared backend and database. Their screens and feature coverage may differ.

This makes the project a useful example of how several types of digital interface can support the same service.

### Visual suggestion

Show three user icons above two access options: Web Browser and Mobile App.

---

## Slide 4 — What is a website?

### On-slide content

**A website is a collection of related web pages and resources accessed through a browser.**

- Usually available under a shared domain or web address.
- Can present text, images, videos, and links.
- Often used to inform, explain, or promote.
- Can contain interactive features and applications.

**Our example:** the public homepage.

### Speaker notes

A website provides pages that people access using browsers such as Chrome, Firefox, Safari, or Edge. A homepage is one page within a website; the terms homepage and website are not identical.

Many websites mainly communicate information, such as an organization's services, contact details, or news. However, a website does not have to be static. It can include search, forms, accounts, and complex interactive services.

In our project, the public homepage demonstrates the informational purpose particularly clearly. It introduces the platform before a visitor signs in.

During local development, a website can also be accessed using a local address instead of a public domain.

### Visual suggestion

Show the homepage in a browser with the address bar visible.

---

## Slide 5 — The website example in our system

### On-slide content

The public homepage explains:

- What the AI Learning Assistant does.
- Its main learning features.
- How the platform works.
- What it offers students and lecturers.
- Where users can sign in.

**Primary purpose here: introduce and explain the service.**

### Speaker notes

Imagine a student visiting the platform for the first time. Before using the learning tools, they want to understand what the platform offers.

Our homepage includes navigation for Features, How It Works, For Students, For Lecturers, and About. It also directs users to sign in.

While displaying this page, I would say: “At this stage, I am learning about the platform. This illustrates the information-sharing role of a website.”

The public homepage and the signed-in tools belong to the same overall web product. They do not need separate domains to serve different purposes.

### Visual suggestion

Annotate a homepage screenshot with three labels: Introduction, Features, and Sign In.

---

## Slide 6 — What is a web application?

### On-slide content

**A web application is software accessed through a browser that lets users perform tasks and work with data.**

- Accepts user input.
- Processes requests and returns results.
- Often saves and retrieves information.
- Can support ongoing workflows.

**Our examples:** AI chat, quizzes, flashcards, and study planning.

### Speaker notes

A web application emphasizes doing something: creating, calculating, communicating, studying, or managing information.

For example, a student enters a question into the AI tutor. The system processes the question and returns an answer. When the student completes a quiz, the system handles the submitted answers and presents the result.

These are application tasks carried out through the browser. Some processing occurs in the browser, while other work occurs on the backend.

A login is common in web applications that store personal information, but it is not part of the definition. A browser-based calculator can be a web application without requiring an account.

### Visual suggestion

Show a simple flow: User input → Processing → Result.

---

## Slide 7 — The web application example in our system

### On-slide content

In the browser, a student can:

- Ask the AI tutor a question.
- Access course documents.
- Review flashcards.
- Complete quizzes.
- Plan study activities and view progress.

**Example workflow:** Open a document → Ask a question → Read the response.

### Speaker notes

This is where we move from reading about the service to using it.

I can open a course document and ask a question about its content. The application sends the request to the backend, where the relevant processing takes place, and displays the response.

Alternatively, I can demonstrate a quiz. The student selects answers and submits them, and the application processes the attempt.

These features show why our browser-based system is a web application: it provides tools that support learning activities and work with user data.

### Visual suggestion

Use one clear screenshot of the AI tutor or quiz interface. Avoid putting every feature on the same slide.

---

## Slide 8 — What is a web portal?

### On-slide content

**A web portal is a central web-based gateway to information and services for a particular audience.**

- Brings relevant resources and tools together.
- Often requires users to sign in.
- Can personalize content and access.
- May organize services by role.

**Our example:** student, lecturer, and administrator workspaces.

### Speaker notes

The word portal emphasizes access and organization. It gives users a central place to find the information and services relevant to them.

In our system, users enter through a shared login page, but their roles determine the workspace they access. A student needs study resources. A lecturer needs teaching and assessment tools. An administrator needs platform-management tools.

A portal may contain many application features and may connect to other systems, but external integrations are not required for something to be a portal.

A login page alone does not make a system a portal. The central, audience-focused organization of resources is the more useful distinction.

### Visual suggestion

Draw one login entry branching to Student, Lecturer, and Administrator workspaces.

---

## Slide 9 — Role-based portals in our system

### On-slide content

| User role | Main purpose | Example tools |
|---|---|---|
| Student | Learn and track progress | Courses, AI tutor, quizzes, flashcards |
| Lecturer | Organize teaching and assessments | Courses, students, assessments, announcements |
| Administrator | Manage the platform | Users, academic management, operations, audit |

**Each role receives access appropriate to its responsibilities.**

### Speaker notes

These workspaces belong to the same platform, but they serve different responsibilities.

The student workspace brings learning resources together. The lecturer workspace organizes course management and teaching tasks. The administrator workspace provides tools for operating the platform.

The distinction involves both the interface and access control. Showing different navigation menus helps users find their tools, while backend authorization determines which protected actions they may perform.

This browser-based platform is therefore both a web application and a web portal: it supports interactive tasks and organizes access to services for different users.

### Visual suggestion

Show three dashboard screenshots with large role labels. Use demonstration accounts or screenshots without private student information.

---

## Slide 10 — What is a mobile application?

### On-slide content

**A mobile application is software designed to run on a mobile device, such as a smartphone or tablet.**

- Designed for smaller screens and touch interaction.
- Commonly installed and opened from an app icon.
- Can use device features with appropriate permissions.
- May connect to online services.

**Our example:** the Expo / React Native app in `mobile/`.

### Speaker notes

A mobile application provides an experience designed for a phone or tablet. Navigation, buttons, and screen layouts are adapted for touch interaction and smaller displays.

Depending on its implementation and permissions, an app can use features such as notifications, file selection, a camera, or a microphone. These capabilities are not exclusive to mobile apps; browsers can also provide some device access.

Our dedicated mobile application is built with Expo and React Native. It has mobile screens for students, lecturers, and administrators, although feature availability can differ from the web interface.

Do not assume that an installed app works fully offline. Features such as AI responses and retrieving server data require connectivity unless specific offline support has been implemented.

### Visual suggestion

Show the mobile dashboard inside a phone frame.

---

## Slide 11 — Mobile app versus website on a phone

### On-slide content

| Opening the web version on a phone | Opening our dedicated mobile app |
|---|---|
| Runs in the phone's browser | Runs through the React Native mobile application |
| Uses the web interface adapted to the screen | Uses a dedicated mobile interface |
| Accessed through a web address | Opened through the installed app or Expo development preview |
| Connects to the platform backend | Connects to the same platform backend |

**A smaller screen alone does not turn a website into a dedicated mobile app.**

### Speaker notes

If I open our web address in Chrome on a phone, I am using the mobile browser version of the web application. If I open our React Native application, I am using the dedicated mobile application.

Both can provide access to the same learning platform. The difference is how the interface is built and delivered, not simply the size of the screen.

During development, the mobile application may be demonstrated through Expo Go or a development build. Describe that as a development preview rather than implying the product has been published to an app store.

There are other approaches, including installable progressive web apps and hybrid apps. For this presentation, the clearest comparison is our responsive browser interface and our separate React Native interface.

### Visual suggestion

Show the browser version and React Native version on two phone screenshots. Keep the browser address bar visible in the first.

---

## Slide 12 — Comparing the four terms

### On-slide content

| Term | Main emphasis | Example in our project |
|---|---|---|
| Website | Related pages and web content | Public homepage and information sections |
| Web application | Performing tasks through a browser | AI tutor, quizzes, and study tools |
| Web portal | Organized access to relevant services | Student, lecturer, and admin workspaces |
| Mobile application | Software designed for mobile devices | Expo / React Native application |

**These categories overlap; they are not four mutually exclusive products.**

### Speaker notes

Website is a broad term. A website can provide application functionality, and a web portal can be implemented as a web application.

In our project, the public homepage demonstrates the informational side. The interactive browser features demonstrate the web application. The role-based workspaces demonstrate the portal. The separate phone interface demonstrates the mobile application.

The terms describe different things: web content, software functionality, organization of access, and the device experience.

As a memory aid, associate website with information, web app with tasks, portal with organized access, and mobile app with the mobile experience. These are helpful associations rather than strict technical boundaries.

### Visual suggestion

Use this table as the slide's main visual. Highlight the last sentence beneath it.

---

## Slide 13 — How the system connects

### On-slide content

```text
Web browser interface          Mobile application
          |                            |
          +-------------+--------------+
                        |
                  Shared backend
                        |
            +-----------+-----------+
            |                       |
     Database and files        AI processing
```

- Web interface: React.
- Mobile interface: Expo / React Native.
- Backend: Node.js / Express with tRPC.
- Database: SQLite through Drizzle ORM.

### Speaker notes

The frontend is the part users see and interact with. Our project has a browser frontend and a mobile frontend.

The backend receives requests, checks access, processes operations, and works with stored information. Both frontends use this shared backend.

For example, a lecturer can manage course information through the platform, and an authorized student can request that information from either supported interface. Sharing a backend and database allows the interfaces to work with common records. It does not mean every screen updates instantly; the interface still needs to retrieve or refresh the information.

For course-document questions, the AI workflow retrieves relevant passages from stored learning materials and uses them to help produce an answer. Keep the explanation at this level unless the audience asks for implementation details.

### Visual suggestion

Recreate the diagram with simple shapes and connectors. Label it “Simplified architecture.”

---

## Slide 14 — Live demonstration

### On-slide content

1. Open the public homepage — **website**.
2. Use the AI tutor or a quiz in the browser — **web application**.
3. Compare role-based dashboards — **web portal**.
4. Open a learning screen in the mobile app — **mobile application**.

**One platform, several ways to present information and deliver services.**

### Speaker notes

First, open the public homepage and briefly point out its introduction and feature descriptions. Say: “This is how visitors learn about the service.”

Next, sign in with a prepared student account and demonstrate one short task. Say: “This browser interface accepts input and performs a learning task, which illustrates a web application.”

Then show the lecturer and administrator dashboards, using prepared screenshots if switching accounts takes too long. Say: “These workspaces organize tools and access around each user's responsibilities, which illustrates a portal.”

Finally, open the dedicated mobile app and display a course or study tool. Say: “This is the mobile interface to the same learning platform.”

Keep the demonstration to approximately three or four minutes. One successful action is more useful than rushing through every feature.

### Visual suggestion

Use four numbered screenshots as a backup if the live demonstration cannot run.

---

## Slide 15 — Check your understanding

### On-slide content

Which concept does each example illustrate most clearly?

1. A visitor reads about the platform's features.
2. A student submits quiz answers in a browser.
3. A lecturer signs in to a workspace containing teaching tools.
4. A student opens the React Native app on a phone.

### Speaker notes

Ask the audience to identify the main concept demonstrated by each situation.

The expected answers are: website, web application, web portal, and mobile application.

For the third example, accept “web application” as a valid observation too. Explain that “web portal” more specifically highlights the organized workspace and access to teaching services. This reinforces the point that the categories overlap.

### Visual suggestion

Reveal the answers one at a time, or use four labeled cards.

---

## Slide 16 — Key takeaways and questions

### On-slide content

- **Website:** related web pages and content.
- **Web app:** interactive software accessed through a browser.
- **Web portal:** a central gateway to relevant information and services.
- **Mobile app:** software designed for mobile devices.

**Our AI Learning Assistant demonstrates all four concepts.**

Questions?

### Speaker notes

Our public homepage introduces the service. Our browser-based learning tools provide application functionality. Our student, lecturer, and administrator workspaces organize access as a portal. Our Expo and React Native application provides a dedicated mobile experience.

The most useful lesson is that these terms are related. One platform can include all of them, and one browser-based interface can be both a web application and a portal.

Thank you. I welcome your questions.

### Visual suggestion

Reuse the four icons from Slide 2 to make the presentation visually consistent.

---

## Presenter preparation

- Prepare one student, lecturer, and administrator demonstration account. Accounts in this project are created by an administrator.
- Start the backend and web interface before presenting. The documented development command from the project root is `pnpm dev`; the default web address is `http://localhost:3000`.
- Start the Expo app from `mobile/` using `npm start`, with the backend address configured for the device or emulator.
- Select one course and one document that are ready for demonstration.
- Prepare a short AI question and a quiz with a predictable demonstration flow.
- Capture backup screenshots of the homepage, a student study tool, the staff dashboards, and the mobile interface.
- Keep the slides and demonstration focused on the interface; there is no need to display `.env` files, credentials, or private student records.
- Rehearse the account transitions and the mobile connection before the presentation.

## Possible audience questions and suggested answers

**Is every website a web application?**

No. Many websites mainly provide content. “Web application” emphasizes software functionality and completing tasks. There is no universally sharp boundary between the terms.

**Can a web application also be a website?**

Yes. Website is a broad term, and a website can provide substantial application functionality.

**Is a web portal different from a web application?**

They describe different aspects of a system. A portal emphasizes a central place to access relevant resources and services. A web application emphasizes interactive functionality. One system can be both.

**Does adding a login page make something a portal?**

No. Login controls access, but a portal also organizes relevant information and services for its audience.

**Does opening the system on a phone make it a mobile app?**

Opening it in a phone browser is mobile web access. This project's dedicated mobile application is the separate Expo / React Native interface.

**Does the mobile app work without the internet?**

Do not assume full offline support. AI responses and access to server information require a connection to the relevant services. Offline functionality depends on what has specifically been implemented.

**Do the web and mobile versions use different databases?**

The documented architecture uses a shared backend and database. The interfaces are separate, but they can work with the same records when connected to the same deployment.

**Are all features identical on web and mobile?**

No. They serve the same platform, but their layouts and feature coverage can differ. Demonstrate only the features available in the version being presented.

**Why provide both web and mobile interfaces?**

They support different usage situations. A browser interface can be convenient for larger-screen tasks and management work. A dedicated mobile interface can make studying and checking information convenient on a phone.

## Project references

These local files support the case-study examples:

- [Project overview and architecture](README.md)
- [Public homepage](client/src/pages/Home.tsx)
- [Browser routes and role workspaces](client/src/App.tsx)
- [Mobile overview](mobile/README.md)
- [Mobile dependencies and scripts](mobile/package.json)
- [Backend documentation](BACKEND.md)

The definitions are general teaching explanations. Project documentation may lag behind implementation; verify the screens you intend to demonstrate before presenting.
