// This file contains raw evaluated code
function getPageContent() {
  // Helper: Check if an element is visible
  function isElementVisible(el) {
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  // Helper: Check if an element should be ignored
  function isElementIgnored(el) {
    if (
      el.textContent == null ||
      (el.textContent.trim() === "" &&
        Array.from(el.children).every(isElementIgnored))
    ) {
      return true;
    }
    return !isElementVisible(el);
  }

  // Helper: Recursively clone nodes without unwanted attributes and text nodes
  function cloneElement(originalNode, newParentNode) {
    originalNode.childNodes.forEach(function (child) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!isElementIgnored(child)) {
          var clonedChild = child.cloneNode(false);
          newParentNode.appendChild(clonedChild);
          cloneElement(child, clonedChild);
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent && child.textContent.trim() !== "") {
          newParentNode.appendChild(child.cloneNode(true));
        }
      }
    });
  }

  // Helper: Clone current document
  function cloneDocument(originalDocument) {
    var newDocument = document.implementation.createHTMLDocument(
      originalDocument.title,
    );
    cloneElement(originalDocument.body, newDocument.body);
    return newDocument;
  }

  // Helper: Simplify div nesting for better readability
  function simplifyDivNesting(element) {
    Array.from(element.children).forEach(function (child) {
      simplifyDivNesting(child);
      if (child.tagName.toLowerCase() === "div") {
        var grandChildren = Array.from(child.children);
        if (
          grandChildren.length === 1 &&
          grandChildren[0].tagName.toLowerCase() === "div"
        ) {
          var singleChildDiv = grandChildren[0];
          while (singleChildDiv.firstChild) {
            child.insertBefore(singleChildDiv.firstChild, singleChildDiv);
          }
          child.removeChild(singleChildDiv);
        }
      }
    });
  }

  // Helper: Clean attributes from the document
  function cleanAttributes(doc) {
    doc.querySelectorAll("*").forEach(function (el) {
      Array.from(el.attributes).forEach(function (attr) {
        if (!["href", "src", "alt", "title"].includes(attr.name)) {
          el.removeAttribute(attr.name);
        }
      });
    });
  }

  // Helper: Clean content string
  function cleanContent(content) {
    return content
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\n\s*\n/g, "\n")
      .trim();
  }

  var newDocument = cloneDocument(document);
  simplifyDivNesting(newDocument.body);
  cleanAttributes(newDocument);
  var content = newDocument.documentElement.innerHTML;
  return cleanContent(content);
}

getPageContent();
