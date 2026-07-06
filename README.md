Live Server Replacement — VS Code Extension

A safer, more reliable replacement for the Live Server extension.
Built because Live Server has 72 million installs and has not been updated in years.


Why this exists

Live Server is the most popular way to preview HTML files in VS Code.
But it has serious problems that have never been fixed.
This extension fixes all of them.


Problems fixed

A. Security vulnerability (CVE-2025-65717)

The problem:
Live Server starts a small local web server on your machine.
Any website you visit while it is running can silently read every file in your project folder
and send them to an attacker — including passwords, API keys, and .env files.
This is a critical-severity vulnerability rated 9.1 out of 10.
It was reported in 2025. It was never patched.

What this extension does instead:


The server only accepts connections from your own machine (bound to 127.0.0.1).
Every request must include a secret token generated when the server starts.
Any request without that token is rejected immediately.
A website you visit in another tab cannot reach this server at all.



B. No maintainer

The problem:
Live Server was built by one developer as a side project.
It has not received a real update in years.
Security researchers tried to contact the maintainer for eight months. No response.
72 million people are using a tool nobody is watching over.

What this extension does instead:


This extension is actively maintained and open source.
All security reports are responded to.
The code is public so anyone can review it.



C. Full page reload on every save

The problem:
Every time you save a file, Live Server refreshes the entire browser page.
This means you lose what you were doing — form inputs get cleared, scroll position resets,
and any JavaScript state disappears.

What this extension does instead:


When you save a CSS file, only the styles are updated in the browser.
The page does not reload. Your state is preserved.
This is called CSS hot reload.
HTML and JavaScript changes still do a full reload, which is acceptable.



D. Port conflict with no explanation

The problem:
Live Server uses port 5500 by default.
If something else is already using that port, Live Server either fails silently
or shows a cryptic error message a beginner cannot understand.

What this extension does instead:


If port 5500 is taken, the extension automatically tries the next available port.
A clear message tells you exactly which port is being used.
If every port in the range fails, you get a readable explanation, not silence.



E. Breaks when you open a single file instead of a folder

The problem:
Live Server requires you to open a folder in VS Code, not just a single file.
If you open a file directly, the "Open with Live Server" option either disappears or does nothing.
There is no message explaining why.

What this extension does instead:


Works whether you have a folder open or just a single file.
If a folder is open, it serves the whole workspace.
If only a file is open, it serves that file from its containing directory.



F. Disappears from the right-click menu

The problem:
After certain actions — switching branches in Git, deleting a file, changing workspaces —
the "Open with Live Server" option vanishes from the right-click menu.
It comes back only after restarting VS Code.

What this extension does instead:


The context menu option is registered in a way that survives workspace changes.
No restart needed after switching branches or renaming folders.



G. Needs a manual restart after workspace changes

The problem:
If you rename a folder, move files, or switch branches while Live Server is running,
it often loses track of your project and stops reloading correctly.
You have to stop it and start it again manually.

What this extension does instead:


The file watcher is re-attached automatically when the workspace changes.
Renaming a folder or switching branches does not break the live preview.



H. No debugging support

The problem:
When something goes wrong in your JavaScript, you have to switch to the browser,
open DevTools manually, find your file, and set a breakpoint there.
There is no connection between VS Code and what is running in the browser.

What this extension does instead:


Integrates with VS Code's built-in debugger.
You can set breakpoints directly in your editor by clicking next to a line number.
When that line runs in the browser, VS Code pauses and shows you every variable's value.
Source maps are served automatically so error messages point to your real file,
not a transformed version of it.
