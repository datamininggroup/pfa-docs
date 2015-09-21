---
layout: page
type: reference
mathjax: true
title: Function library
order: 40
noToc: true
---

<script>
function updateFilter() {
    var filt = $("#nameFilter").val();
    if (filt == "") {
        $(".PFAhead").css("display", "block");
        $(".PFAfcndef").css("display", "block");
    }
    else {
        $(".PFAhead").css("display", "none");
        $(".PFAfcndef").css("display", "none");
        $(".PFAfcndef[id*='" + filt + "']").css("display", "block");
    }
}
</script>

<form id="filter" style="margin-top: 30px">
<input type="text" name="nameFilter" id="nameFilter" style="border: 1px solid #0e5f80; padding: 5px; width: 50%; margin-bottom: 20px; font-size: 20px;" placeholder="filter by function name" onkeyup="updateFilter()">
</form>

{% include libfcns.html %}
