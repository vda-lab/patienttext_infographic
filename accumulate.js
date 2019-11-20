// TODOS
// doubles are removed
// allow user to remove events
// show before or after time zoom (arrow?)

// reload window on resize
$(window).resize(function() {
    window.location.reload();
});


const FILE = 3;

const minRectWidth = 5,
    initDelay = 1500,
    initDuration = 2500,
    antiFlickerDuration = 200,
    normalOpacity = 0.6,
    textOpacity = 0.15,
    normalUncertaintyOpacity = 0.1,
    formatTime = d3.timeFormat("%B %d, %Y"),
    daysOffsetForZoom = 3;

function color(type) {
    switch (type) {
        case "OCCURRENCE":
            return "rgb(31, 119, 180)"; // blue
        case "CLINICAL_DEPT":
            return "rgb(255, 127, 14)"; // orange
        case "TREATMENT":
            return "rgb(44, 160, 44)"; // green
        case "TEST":
            return "rgb(148, 103, 189)"; //purple
        case "EVIDENTIAL":
            return "rgb(140, 86, 75)"; // brown
        case "PROBLEM":
            return "rgb(214, 39, 40)"; //red
        default:
            return "transparent";
    }
}
// rgb(227, 119, 194) pink
// rgb(127, 127, 127) grey
// rgb(188, 189, 34) lightgreen
// rgb(23, 190, 207) lightblue

// set the dimensions and margins of the graph
const margin = { top: 20, right: 60, bottom: 60, left: 160 };

const mainWidgetWidth = (2 * ((innerWidth) / 3)) - margin.left - margin.right,
    mainWidgetHeight = (9 * ((innerHeight) / 10)) - margin.top - margin.bottom;

$(function() { //DOM Ready
    $(".gridster ul").gridster({
        widget_margins: [0, 0],
        widget_base_dimensions: [(innerWidth) / 3, (innerHeight) / 10],
    });
});

// append the svg object to the corresponding div
const svg = d3.select("#dataviz_brushZoom")
    .append("svg")
    .attr("width", mainWidgetWidth + margin.left + margin.right)
    .attr("height", mainWidgetHeight + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

//Read the data
d3.xml("testset_annotated_ground_truth/" + FILE + ".xml").then(xml => {

    // get text from the letter
    letterText = xml.querySelector("TEXT").textContent
    const admissionDate = new Date(letterText.split("\n")[2]);
    const dischargeDate = new Date(letterText.split("\n")[4]);

    // parse all data
    let data = [].map.call(xml.querySelectorAll("EVENT"), function(event) {
        return {
            mostLikelyStart: new Date(event.getAttribute("most-likely-start")),
            mostLikelyEnd: new Date(event.getAttribute("most-likely-end")),
            lowerBoundStart: new Date(event.getAttribute("lowerbound-start")),
            lowerBoundEnd: new Date(event.getAttribute("lowerbound-end")),
            upperBoundStart: new Date(event.getAttribute("upperbound-start")),
            upperBoundEnd: new Date(event.getAttribute("upperbound-end")),
            label: event.getAttribute("text"),
            type: event.getAttribute("type"),
            id: event.getAttribute("text").replace(/\s/g, "")
        };
    });

    const minDate = _.min(data.map(d => d.lowerBoundStart));
    const maxDate = _.max(data.map(d => d.upperBoundEnd));

    // todo: doubles are filtered in this version
    data = _.unique(data, "label");

    // group event by type
    data = _.sortBy(data, d => d.type)

    /*
     create and populate textview
    */

    // create spans for every event
    data.forEach(d => {
        const backgroundColor = rgbaColor(d);
        letterText = letterText.replace(d.label,
            "<span onmouseover=\"highlight(this)\" onmouseout=\"unhighlight(this)\" " +
            "color=\"" + color(d.type) +
            "\" style=\"background-color:" + backgroundColor +
            "\" id=" + d.id + ">" +
            d.label +
            " </span>");
    });

    // split report on hpi and hospital course
    splittedHPI = letterText.split(/history of present illness :|hpi :/i);
    splittedHC = splittedHPI[1].split(/hospital course :|Brief Hospital Course :/i);

    // populate the corresponding views
    $("#admissiondatep").html(formatTime(admissionDate));
    $("#dischargedatep").html(formatTime(dischargeDate));
    $("#hpip").html(splittedHC[0]);
    $("#hospitalcoursep").html(splittedHC[1]);

    // add tooltip on hover
    const tip = d3.tip()
        .attr("class", "d3-tip")
        .direction('n')
        .offset(function() {
            let thisX = this.getBBox().x;
            let thisWidth = this.getBBox().width;
            if (thisWidth > mainWidgetWidth) {
                return [0, mainWidgetWidth / 2]
            } else if (thisX + thisWidth > mainWidgetWidth) {
                return [0, -thisWidth / 2 + (mainWidgetWidth - thisX) / 2] // [top, left]
            } else if (thisX < 0) {
                return [0, (thisWidth / 2) - (thisX + thisWidth) / 2];
            } else {
                return [0, 0];
            }
        })
        .html(d => {
            // code here otherwise does not work in mouseover... 
            markWords(d, color)
            select_axis_label(d)
                .style("fill", color(d.type))
                .style("font-weight", "bold")
                .style("font-size", "20px")
            highlightMaster(d.id, color(d.type))
            return "<span style=\"color:" + color(d.type) + "\">" + d.type + ": </span><span>" + d.label + "</span>"
        });
    svg.call(tip);

    // Add X axis
    const x = d3.scaleTime()
        .domain([minDate, maxDate])
        .range([0, mainWidgetWidth]);
    const xAxis = svg.append("g")
        .call(d3.axisTop(x));

    const verGridLines = d3.axisTop()
        .tickFormat("")
        .tickSize(-mainWidgetHeight)
        .scale(x);

    xAxis.append("g")
        .attr("class", "vergrid")
        .call(verGridLines);

    // Add Y axis
    const y = d3.scaleBand()
        .domain(data.map(d => d.label))
        .range([mainWidgetHeight, 0])
        .padding([0.2]);
    svg.append("g")
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y));

    // Add a clipPath: everything out of this area won't be drawn.
    var clip = svg.append("defs").append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", mainWidgetWidth)
        .attr("height", mainWidgetHeight)
        .attr("x", 0)
        .attr("y", 0);

    // Add brushing
    var brush = d3.brushX() // Add the brush feature using the d3.brush function
        .extent([
            [0, 0],
            [mainWidgetWidth, mainWidgetHeight]
        ]) // initialise the brush area: start at 0,0 and finishes at width,height: it means I select the whole graph area
        .on("end", updateChart) // Each time the brush selection changes, trigger the 'updateChart' function

    // Create the scatter variable: where both the circles and the brush take place
    var scatter = svg.append('g')
        .attr("clip-path", "url(#clip)")

    // Add the brushing before the elements (for mouseover)
    scatter
        .append("g")
        .attr("class", "brush")
        .call(brush);

    scatter
        .selectAll(".mostlikely")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "mostlikely")
        .attr("id", d => "mostlikely-" + d.id)
        .attr("width", d => Math.max(minRectWidth, x(d.mostLikelyEnd) - x(d.mostLikelyStart)))
        .attr("height", y.bandwidth())
        .attr("y", d => y(d.label))
        .attr("x", d => x(d.mostLikelyStart))
        .style("fill", d => color(d.type))
        .style("opacity", normalOpacity)
        .on('mouseover', tip.show)
        .on('mouseout', d => {
            tip.hide()
            unMarkWords(d);
            unhighlightMaster(d.id, color(d.type));
        });

    scatter
        .selectAll(".lower_uncertainty")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "lower_uncertainty")
        .attr("id", d => "lower_uncertainty-" + d.id)
        .attr("width", d => x(d.mostLikelyStart) - x(d.lowerBoundStart))
        .attr("height", y.bandwidth())
        .attr("y", d => y(d.label))
        .attr("x", d => x(d.lowerBoundStart))
        .style("fill", d => color(d.type))
        .style("opacity", normalUncertaintyOpacity)
        .on('mouseover', tip.show)
        .on('mouseout', d => {
            tip.hide()
            unMarkWords(d);
            unhighlightMaster(d.id, color(d.type));
        });

    scatter
        .selectAll(".upper_uncertainty")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", d => "upper_uncertainty")
        .attr("id", d => "upper_uncertainty-" + d.id)
        .attr("width", d => x(d.upperBoundEnd) - x(d.mostLikelyEnd))
        .attr("height", y.bandwidth())
        .attr("y", d => y(d.label))
        .attr("x", d => x(d.mostLikelyEnd))
        .style("fill", d => color(d.type))
        .style("opacity", normalUncertaintyOpacity)
        .on('mouseover', tip.show)
        .on('mouseout', d => {
            tip.hide()
            unMarkWords(d);
            unhighlightMaster(d.id, color(d.type));
        });

    scatter
        .append("line")
        .attr("class", "admissionDate")
        .attr("x1", x(admissionDate))
        .attr("x2", x(admissionDate))
        .attr("y1", 0)
        .attr("y2", mainWidgetHeight)
        .style("stroke-width", 2)
        .style("stroke", "darkgrey")
        .style("fill", "none");

    scatter
        .append("line")
        .attr("class", "dischargeDate")
        .attr("x1", x(dischargeDate))
        .attr("x2", x(dischargeDate))
        .attr("y1", 0)
        .attr("y2", mainWidgetHeight)
        .style("stroke-width", 2)
        .style("stroke", "darkgrey")
        .style("fill", "none");

    // zoom in to mostlikely range
    minLikelyDate = _.min(data.map(d => d.mostLikelyStart));
    maxLikelyDate = _.max(data.map(d => d.mostLikelyEnd));
    updateChart(x(new Date(admissionDate.getTime() - (24 * 60 * 60 * 1000) * daysOffsetForZoom)), x(new Date(dischargeDate.getTime() + (24 * 60 * 60 * 1000) * daysOffsetForZoom)));

    // A function that set idleTimeOut to null
    var idleTimeout // var because used in idled()
    function idled() { idleTimeout = null; }

    // A function that update the chart for given boundaries
    function updateChart(startX, endX) {

        let duration = 1000;
        let delay = 0;

        if (startX) {
            extent = [startX, endX];
            duration = initDuration;
            delay = initDelay;
        } else {
            extent = d3.event.selection
        }

        // If no selection, back to initial coordinate. Otherwise, update X axis domain
        if (!extent) {
            if (!idleTimeout) return idleTimeout = setTimeout(idled, 350); // This allows to wait a little bit
            x.domain([minDate, maxDate]);
        } else {
            x.domain([x.invert(extent[0]), x.invert(extent[1])])
            scatter.select(".brush").call(brush.move, null) // This remove the grey brush area as soon as the selection has been done
        }

        // Update axis and circle position
        xAxis.transition().delay(delay).duration(duration).call(d3.axisTop(x))

        xAxis.append("g")
            .attr("class", "vergrid")
            .transition().delay(delay + 750).duration(duration)
            .call(verGridLines);

        scatter
            .selectAll(".mostlikely")
            .transition().delay(delay).duration(duration)
            .attr("width", d => Math.max(minRectWidth, x(d.mostLikelyEnd) - x(d.mostLikelyStart)))
            .attr("x", d => x(d.mostLikelyStart))

        scatter
            .selectAll(".lower_uncertainty")
            .transition().delay(delay).duration(duration)
            .attr("width", d => x(d.mostLikelyStart) - x(d.lowerBoundStart))
            .attr("x", d => x(d.lowerBoundStart))

        scatter
            .selectAll(".upper_uncertainty")
            .transition().delay(delay).duration(duration)
            .attr("width", d => x(d.upperBoundEnd) - x(d.mostLikelyEnd))
            .attr("x", d => x(d.mostLikelyEnd))

        scatter
            .selectAll(".admissionDate")
            .transition().delay(delay).duration(duration)
            .attr("x1", x(admissionDate))
            .attr("x2", x(admissionDate))

        scatter
            .selectAll(".dischargeDate")
            .transition().delay(delay).duration(duration)
            .attr("x1", x(dischargeDate))
            .attr("x2", x(dischargeDate))
    }
});

function rgbaColor(d) {
    bgRGB = d3.color(color(d.type));
    return "rgba(" + bgRGB.r + "," + bgRGB.g + "," + bgRGB.b + "," + textOpacity + ")";
}

function markWords(d) {
    d3.select("#" + d.id)
        .transition(antiFlickerDuration)
        .style("background", color(d.type))
        .style("color", "white");
}

function unMarkWords(d) {
    select_axis_label(d)
        .transition(antiFlickerDuration)
        .style("fill", "black")
        .style("font-weight", "normal")
        .style("font-size", "10px")
    bgRGB = d3.color(color(d.type));
    backgroundColor = "rgba(" + bgRGB.r + "," + bgRGB.g + "," + bgRGB.b + "," + textOpacity + ")";
    d3.select("#" + d.id)
        .transition(antiFlickerDuration)
        .style("background", backgroundColor)
        .style("color", "black")
}

function unhighlight(x) {
    unhighlightMaster($(x).text().trim().replace(/\s/g, ""), $(x).attr("color"));
}

function unhighlightMaster(id, color) {
    d3.selectAll(".mostlikely")
        .transition(antiFlickerDuration)
        .style("opacity", normalOpacity)

    d3.selectAll(".lower_uncertainty")
        .transition(antiFlickerDuration)
        .style("opacity", normalUncertaintyOpacity)

    d3.selectAll(".upper_uncertainty")
        .transition(antiFlickerDuration)
        .style("opacity", normalUncertaintyOpacity)

    bgRGB = d3.color(color);
    backgroundColor = "rgba(" + bgRGB.r + "," + bgRGB.g + "," + bgRGB.b + "," + textOpacity + ")";

    d3.select("#" + id)
        .transition(antiFlickerDuration)
        .style("background", backgroundColor)
        .style("color", "black");

    d3.select('.axis--y')
        .selectAll('text')
        .filter(function(z) {
            return z.replace(/\s/g, "") == id;
        })
        .transition(antiFlickerDuration)
        .style("fill", "black")
        .style("font-weight", "normal")
        .style("font-size", "10px")
}

function highlightMaster(id, color) {
    d3.selectAll(".mostlikely")
        .transition(antiFlickerDuration)
        .style("opacity", "0.2")

    d3.select("#mostlikely-" + id)
        .transition(antiFlickerDuration)
        .style("opacity", 1)

    d3.select("#lower_uncertainty-" + id)
        .transition(antiFlickerDuration)
        .style("opacity", normalOpacity - 0.1)

    d3.select("#upper_uncertainty-" + id)
        .transition(antiFlickerDuration)
        .style("opacity", normalOpacity - 0.1)

    d3.select("#" + id)
        .transition(antiFlickerDuration)
        .style("background", color)
        .style("color", "white");

    d3.select('.axis--y')
        .selectAll('text')
        .filter(function(z) {
            return z.replace(/\s/g, "") == id;
        })
        .transition(antiFlickerDuration)
        .style("fill", color)
        .style("font-weight", "bold")
        .style("font-size", "20px")
}

function highlight(x) {
    highlightMaster($(x).text().trim().replace(/\s/g, ""), $(x).attr("color"))
}

function select_axis_label(d) {
    return d3.select('.axis--y')
        .selectAll('text')
        .filter(function(x) { return x == d.label; });
}