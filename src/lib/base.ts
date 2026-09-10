export function withBase(path = '') {
	const root = import.meta.env.BASE_URL.replace(/\/?$/, '/');
	return `${root}${String(path).replace(/^\//, '')}`;
}
