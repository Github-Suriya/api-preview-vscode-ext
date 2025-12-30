<!-- Project Start -->
npm run watch -> ctrl + f5

<!-- Version Update -->
<!-- Note: after commiting the changes, run the following commands -->
npm version patch
npm version minor
npm version major

<!-- Compile Project -->
npm run compile

<!-- Upload to VS Code -->
vsce package
vsce publish

<!-- Publish to Open VSX -->
open-vsx publish -p <personal access token>