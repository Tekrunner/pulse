export default {
  root: process.env.PULSE_SITE_ROOT || "site",
  output: process.env.PULSE_SITE_OUTPUT || "dist",
  base: "/pulse/",
  title: "Pulse report pilot",
  style: "style.css",
  globalStylesheets: [],
  footer: null,
  sidebar: false,
  pager: false,
};
