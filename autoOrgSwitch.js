(function () {
  console.log("[Forethought Toolbox] autoOrgSwitch.js injected");

  const params = new URLSearchParams(window.location.search);
  const orgName = params.get("org");
  if (!orgName) return alert("No ?org= provided in URL");

  const maxAttempts = 20;
  const delay = 500;

  function waitForProfileButton(attempt = 0) {
    const profileBtn = document.querySelector(
      'button[aria-label="Account Setting"]',
    );
    if (profileBtn) {
      profileBtn.click();
      waitForChangeOrg(0);
    } else if (attempt < maxAttempts) {
      setTimeout(() => waitForProfileButton(attempt + 1), delay);
    } else {
      alert("❌ Profile button not found after retries.");
    }
  }

  function waitForChangeOrg(attempt) {
    const changeOrgBtn = document.querySelector('[data-testid="change-org"]');
    if (changeOrgBtn) {
      changeOrgBtn.click();
      setTimeout(() => typeInSearchBar(0), delay);
    } else if (attempt < maxAttempts) {
      setTimeout(() => waitForChangeOrg(attempt + 1), delay);
    } else {
      alert("❌ 'Change Org' button not found after retries.");
    }
  }

  function typeInSearchBar(attempt) {
    const input = document.querySelector("input.SearchBar-input");
    if (input) {
      input.focus();
      input.value = orgName;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      setTimeout(() => waitForOrgAndConfirm(0), delay);
    } else if (attempt < maxAttempts) {
      setTimeout(() => typeInSearchBar(attempt + 1), delay);
    } else {
      alert("❌ Search bar not found.");
    }
  }

  function waitForOrgAndConfirm(attempt) {
    const orgOption = [
      ...document.querySelectorAll("button.ModalItem-container"),
    ].find((btn) => btn.innerText.includes(orgName));
    const confirmBtn = document.querySelector(
      ".BreakdownModal-applyBreakdownButton",
    );
    if (orgOption && confirmBtn) {
      orgOption.click();
      setTimeout(() => confirmBtn.click(), 300);
    } else if (attempt < maxAttempts) {
      setTimeout(() => waitForOrgAndConfirm(attempt + 1), delay);
    } else {
      alert("❌ Org or Confirm button not found.");
    }
  }

  // Kick off retry logic
  waitForProfileButton();
})();
