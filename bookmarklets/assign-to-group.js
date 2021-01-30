javascript:(async function () {
	/***** BEGIN USER CUSTOMIZATIONS *****/
	const groupMembers = `George Washington;John Adams;Thomas Jefferson`;
	/*****  END USER CUSTOMIZATIONS  *****/

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

	/*** Exception handling ***/

	const errorMessages = {
		400: 'Your group is empty. Follow the instructions to customize the bookmarklet.',
		410: 'The name "%s" was not found. Check your group for misspellings.',
		411: 'The name "%s" appears more than once. Enter a more specific name that is unique to one student.',
		500: 'Cannot find the assignees menu. Ensure you are on the screen to Create or Edit an assignment.',
		510: 'The assignees menu failed to open.',
		511: 'Clickable element not found.',
		520: 'Cannot find the "All students" option in the assignees menu.',
		530: 'Cannot parse the "All students" option in the assignees menu.',
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
		// Find the ancestor element with the jsaction events - https://github.com/google/jsaction
		let $eventListener = $target;
		while (
			$eventListener &&
			!/\bmouseup\b/i.test($eventListener.getAttribute('jsaction'))
		) {
			$eventListener = $eventListener.parentElement;
		}

		if (!$eventListener) throw new CustomError(511);

		$eventListener.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		$eventListener.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

		await wait(150);
	}

	function findByText($context, text) {
		const descendents = $context.querySelectorAll('*');
		return [...descendents].filter((el) =>
			el.childElementCount === 0 && el.innerHTML.includes(text)
		);
	}

	function isChecked($option) {
		let $cursor = $option;

		while ($cursor && !$cursor.hasAttribute('aria-checked')) {
			$cursor = $cursor.parentElement;
		}

		if (!$cursor) return undefined;
		return /true/i.test($cursor.ariaChecked);
	}

	async function wait(milliseconds) {
		return new Promise((resolve) => setTimeout(resolve, milliseconds));
	}

	/*** Main logic ***/

	try {
		const { host, protocol } = window.location;
		if (protocol !== 'https:' || host !== 'classroom.google.com') throw new CustomError(540);

		// Parse the user's input

		const names = getNames();
		if (names.length === 0) throw new CustomError(400);

		// Find and open the assignee menu if no menu is open yet

		let $assigneeListToggle;
		const isAnyMenuOpen = !!document.querySelector('[role="menu"][style]');

		if (!isAnyMenuOpen) {
			// Find the menu labeled "For ___ student(s)"
			$assigneeListToggle = document.querySelector('[aria-label^="for"i][aria-label*="student"i]');
			if (!$assigneeListToggle) throw new CustomError(500);
	
			await click($assigneeListToggle);
			await wait(300);
		}

		const $assigneeList = document.querySelector('[role="menu"][style]');
		if (!$assigneeList) throw new CustomError(510);

		// Assert that the assignee menu matches expectations

		const $optionsAllStudents = findByText($assigneeList, 'All students');
		if ($optionsAllStudents.length !== 1) throw new CustomError(520);

		const isAllStudentsChecked = isChecked($optionsAllStudents[0]);
		if (isAllStudentsChecked === undefined) throw CustomError(530);

		for (const name of names) {
			const $optionsName = findByText($assigneeList, name);
			if ($optionsName.length < 1) throw new CustomError(410, name);
			if ($optionsName.length > 1) throw new CustomError(411, name);
		}

		// All checks passed -- assign the group members

		// Clear all selections
		if (!isAllStudentsChecked) await click($optionsAllStudents[0]);
		await click($optionsAllStudents[0]);

		for (const name of names) {
			const [$optionName] = findByText($assigneeList, name);
			await click($optionName);
		}

		if ($assigneeListToggle) await click($assigneeListToggle);
	} catch (error) {
		alert(`The bookmarklet encountered an error:\n\n${error.message}`);
		throw error;
	}
})();
