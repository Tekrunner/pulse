const forbidden = /(?:^|[\/@])(?:chart\.js|d3(?:-[^\/@]+)?|echarts|highcharts|plotly(?:\.js)?|vega(?:-[^\/@]+)?|recharts|victory|nivo|apexcharts|billboard\.js|c3|visx|antv|chartist|fusioncharts|amcharts|plot|uplot)(?:@|$|\/)/i;

export function findForbiddenDependency(dependencies) {
  return Object.entries(dependencies).find(
    ([name, spec]) => forbidden.test(name) || forbidden.test(String(spec).replace(/^npm:/, "")),
  );
}
