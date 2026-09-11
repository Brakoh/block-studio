import { parse } from 'yaml';
import copyRaw from '../pages/copy.yml?raw';

export type CopyFact = {
	label: string;
	value: string;
};

export type Copy = {
	identity: {
		word: string;
		email: string;
	};
	window_title: string;
	chrome: {
		watermark: string;
		side_strip: string;
		corners: {
			tl: [string, string];
			tr: [string, string];
			bl: [string, string];
			br: [string, string];
		};
	};
	home: {
		nav: {
			about: string;
			work: string;
			contact: string;
		};
		hero: {
			location: string;
			coord: string;
		};
		dividers: [string, string, string];
		about: {
			label: string;
			number: string;
			paragraphs: string[];
			facts: CopyFact[];
		};
		work: {
			label: string;
			number: string;
		};
		contact: {
			label: string;
			number: string;
			title: [string, string];
			places: CopyFact[];
		};
		footer: {
			copyright: string;
			coord: string;
		};
	};
	globe: {
		return: string;
		tags: {
			loudness: string;
			dr_strange: string;
			waste: string;
		};
	};
	waste: {
		camera_unavailable: string;
		hoarding: string;
		inscriptions: {
			sector: string;
			basin: string;
			plinth: string;
			elevation: string;
		};
	};
	loudness: {
		traffic: string;
	};
};

export const copy = parse(copyRaw) as Copy;
