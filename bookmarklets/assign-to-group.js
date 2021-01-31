javascript:(async function () {
	/***** BEGIN USER CUSTOMIZATIONS *****/
	const groupMembers = `George Washington;John Adams;Thomas Jefferson`;

	// isExclusionGroup = false: assign to this group
	// isExclusionGroup = true: assign to all students not in this group
	const isExclusionGroup = false;
	/*****  END USER CUSTOMIZATIONS  *****/

	const script = 1;
	const version = 1;

	/*** User inputs ***/

	const nameDelimiter = ';';

	function getNames() {
		if (typeof groupMembers === 'undefined') return [];

		return groupMembers
			.split(nameDelimiter)
			.map((n) => n.trim())
			.filter((n) => n !== '');
	}

	function getIsExclusionGroup() {
		if (typeof isExclusionGroup === 'undefined') return false;
		if (typeof isExclusionGroup === 'string') return /true/i.test(isExclusionGroup);
		return Boolean(isExclusionGroup);
	}

	/*** Exception handling ***/

	const errorMessages = {
		400: 'Your group is empty. Follow the instructions to customize the bookmarklet.',
		410: 'The name "%s" was not found. Check your group for misspellings.',
		411: 'The name "%s" appears more than once. Enter a more specific name that is unique to one student.',
		500: 'Cannot find the assignees menu. Ensure you are on the screen to Create or Edit an assignment.',
		510: 'The assignees menu failed to open.',
		520: 'Cannot find the "All students" option in the assignees menu.',
		530: 'Cannot parse student names in the assignees menu.',
		540: 'You must run this bookmarklet on https://classroom.google.com/.',
	};

	class CustomError {
		constructor(errorCode, ...values) {
			this.errorCode = errorCode;
			this.values = values;

			const errorMessage = printf(errorMessages[errorCode], values);
			this.message = `[${version}.${errorCode}] ${errorMessage}`;
		}
	}

	function printf(template, values = []) {
		return values.reduce((t, v) => t.replace(/%s/, v), template);
	}

	/*** DOM helpers ***/

	async function click($target) {
		$target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		$target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

		await wait(150);
	}

	function getAssigneeListToggle() {
		// Find the menu labeled "For ___ student(s)"
		const $allStudentToggles = document.querySelectorAll('[aria-label^="for"i][aria-label*="student"i]');
		// Detect and ignore hidden UIs
		const $hiddenStudentToggles = document.querySelectorAll('[aria-hidden="true"] [aria-label^="for"i][aria-label*="student"i]');

		return [...$allStudentToggles]
			.find(($toggle) => ![...$hiddenStudentToggles].includes($toggle));
	}

	function getAllOptions($context) {
		const $options = $context.querySelectorAll('[aria-checked]');

		return [...$options].reduce((map, $option) =>
			map.set(getOptionLabel($option), $option)
		, new Map());
	}

	function getOptionLabel($option) {
		const $descendents = $option.querySelectorAll('*');
		const $labels = [...$descendents].filter((n) =>
			// Find innermost text node, ignore icons
			n.childElementCount === 0 && /\w/.test(n.innerHTML)
		);
		if ($labels.length !== 1) throw new CustomError(530);

		return $labels[0].innerHTML;
	}

	function isChecked($option) {
		return /true/i.test($option.ariaChecked);
	}

	async function wait(milliseconds) {
		return new Promise((resolve) => setTimeout(resolve, milliseconds));
	}

	/*** Main logic ***/

	try {
		const { host, protocol } = window.location;
		if (protocol === 'https:' && host === 'www.wimpyprogrammer.com' && window.editBookmarklet)
			return window.editBookmarklet({ groupMembers, isExclusionGroup, script, version });
		if (protocol !== 'https:' || host !== 'classroom.google.com')
			throw new CustomError(540);

		// Parse the user's input

		const names = getNames();
		if (names.length === 0) throw new CustomError(400);

		// Find and open the assignee menu if no menu is open yet

		let $assigneeListToggle;
		const isAnyMenuOpen = !!document.querySelector('[role="menu"][style]');

		if (!isAnyMenuOpen) {
			// Find the menu labeled "For ___ student(s)"
			$assigneeListToggle = getAssigneeListToggle();
			if (!$assigneeListToggle) throw new CustomError(500);
	
			await click($assigneeListToggle);
			await wait(300);
		}

		const $assigneeList = document.querySelector('[role="menu"][style]');
		if (!$assigneeList) throw new CustomError(510);

		// Assert that the assignee menu matches expectations

		const allOptions = getAllOptions($assigneeList);

		const $optionAllStudents = allOptions.get('All students');
		if (!$optionAllStudents) throw new CustomError(520);

		const allStudentNames = [...allOptions.keys()].filter((n) => n !== 'All students');

		const fullNames = names.map((name) => {
			const matches = allStudentNames.filter((test) => test.includes(name));
			if (matches.length < 1) throw new CustomError(410, name);
			if (matches.length > 1) throw new CustomError(411, name);
			return matches[0];
		});

		// All checks passed -- assign the group members

		const isLargeGroup = names.length / allStudentNames.length > 0.5;
		const isAssignmentForMostStudents = isLargeGroup !== getIsExclusionGroup();

		// Clear all selections
		if (!isChecked($optionAllStudents)) await click($optionAllStudents);
		if (!isAssignmentForMostStudents) await click($optionAllStudents);

		const namesToToggle = isLargeGroup
			// Get all names not in fullNames
			? allStudentNames.filter((name) => !fullNames.includes(name))
			: fullNames;

		for (const name of namesToToggle) {
			const $option = allOptions.get(name);
			await click($option);
		}

		if ($assigneeListToggle) await click($assigneeListToggle);
	} catch (error) {
		const helpUrlQuery = new URLSearchParams({
			script,
			version,
			error: error.errorCode || error.message,
		});
		const helpUrl = new URL('https://www.wimpyprogrammer.com/faster-google-classroom-assignments-with-a-bookmarklet#help');
		helpUrl.search = helpUrlQuery;

		prompt(
			`The bookmarklet encountered an error:\n\n${error.message}\n\nFor help visit:`,
			helpUrl
		);
		throw error;
	}
})();
