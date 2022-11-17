 
    function closeAllLists(elmnt) {
      /*close all autocomplete lists in the document,
      except the one passed as an argument:*/
      var x = document.getElementsByClassName("autocomplete-items");
      for (var i = 0; i < x.length; i++) {
        if (elmnt != x[i] ) {
        x[i].parentNode.removeChild(x[i]);
        }
      }
    }
  
    document.addEventListener("click", function (e) {
      closeAllLists(e.target);
    });
  
    function recipeAutocomplete(inp,entries) {
      var currentFocus;
      /*execute a function when someone writes in the text field:*/
      inp.addEventListener("input", function(e) {
          var dropdown,match,i,val = this.value;
          /*close any already open lists of autocompleted values*/
          closeAllLists();
          if (!val) { return false;}
          currentFocus = -1;
  
          //var dropdown;
          /*create a DIV element that will contain the items (values):*/
          dropdown = document.createElement("DIV");
          dropdown.setAttribute("id", this.id + "autocomplete-list");
          dropdown.setAttribute("class", "autocomplete-items");
          /*append the DIV element as a child of the autocomplete container:*/
          this.parentNode.appendChild(dropdown);
          /*for each item in the array...*/
  
          
          for (i = 0; i < entries.length; i++) {
            /*check if the item starts with the same letters as the text field value:*/
            if (entries[i].name.substr(0, val.length).toUpperCase() == val.toUpperCase()) {
              //var match;
              /*create a DIV element for each matching element:*/
              match=document.createElement("DIV");
              /*make the matching letters bold:*/
              match.innerHTML = "<strong>" + entries[i].name.substr(0, val.length) + "</strong>";
              match.innerHTML += entries[i].name.substr(val.length);
              /*insert a input field that will hold the current array item's value:*/
              match.innerHTML += "<input type='hidden' value='" + entries[i].name + "'>";
              /*execute a function when someone clicks on the item value (DIV element):*/
              match.addEventListener("click", function(e) {
                  /*insert the value for the autocomplete text field:*/
                  inp.value = this.getElementsByTagName("input")[0].value;
                  var j;
                  for (j = 0; j < entries.length; j++) {//last one entered if dupes
                    if (entries[j].name.toUpperCase() == inp.value.toUpperCase()) {
                      document.querySelector(`#calories`).value = entries[j].calories;
                      document.querySelector(`#protein`).value = entries[j].protein;
                      document.querySelector(`#fiber`).value = entries[j].fiber;
                      document.querySelector(`#sodium`).value = entries[j].sodium;
                    }
                  }
  
              });
              dropdown.appendChild(match);
            }
          }
          
      });
    }