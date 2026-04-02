export function getServiceName(fallback: string): string {
  return process.env.SERVICE_NAME ||
    process.env.OTEL_SERVICE_NAME ||
    process.env.npm_package_name ||
    fallback;
}

export function getServiceVersion(fallback: string): string {
  return process.env.SERVICE_VERSION ||
    process.env.npm_package_version ||
    fallback;
}
