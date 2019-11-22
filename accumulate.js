// TODOS
// doubles are removed
// Only POS polarity are shown
// show before or after time zoom (arrow?)
// check for negative rect

// reload window on resize
$(window).resize(function() {
    window.location.reload();
});

MicroModal.init();
let selectedElement;
let crossData;
let preventUpdate = false;
let admissionDate;
let dischargeDate;

const FILE = 3;

const minRectWidth = 2,
    initDelay = 1000,
    initDuration = 2500,
    defaultDuration = 1000,
    defaultDelay = 0,
    antiFlickerDuration = 200,
    normalOpacity = 0.6,
    textOpacity = 0.25,
    normalUncertaintyOpacity = 0.2,
    formatTime = d3.timeFormat("%B %d, %Y"),
    daysOffsetForZoom = 3;

let filter = ["OCCURRENCE", "CLINICAL_DEPT", "TEST", "TREATMENT", "EVIDENTIAL", "PROBLEM"];

function color(type) {
    switch (type) {
        case "OCCURRENCE":
            return "rgb(31, 119, 180)"; // blue
        case "CLINICAL_DEPT":
            return "rgb(227, 119, 194)"; // pink
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
// rgb(255, 127, 14) orange
// rgb(127, 127, 127) grey
// rgb(188, 189, 34) lightgreen
// rgb(23, 190, 207) lightblue

// set the dimensions and margins of the graph
const margin = { top: 20, right: 10, bottom: 10, left: 150 };

const mainWidgetWidth = (4 * ((innerWidth) / 6)) - margin.left - margin.right,
    mainWidgetHeight = (9 * ((innerHeight) / 10)) - margin.top - margin.bottom;

$(function() { //DOM Ready
    $(".gridster ul").gridster({
        widget_margins: [0, 0],
        widget_base_dimensions: [(innerWidth) / 3, (innerHeight) / 10],
    });

    // append the svg object to the corresponding div
    const svg = d3.select("#dataviz_brushZoom")
        .append("svg")
        .attr("width", mainWidgetWidth + margin.left + margin.right)
        .attr("height", mainWidgetHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    $.get("testset_annotated_ground_truth/content.txt", function(result) {
        let files = (_.filter(result.split("\n"), (d) => /.xml/i.test(d)));

        var options = $("#options");
        //don't forget error handling!
        files = _.sortBy(files, d => d.length);
        files.forEach(item => {
            options.append($("<option />").val(item).text(item.split(".")[0]));
        })

        $("#options").on('change', function() {
            readFile(this.value);
        });

        readFile(FILE + ".xml")

        function readFile(file) {

            d3.xml("testset_annotated_ground_truth/" + file).then(xml => {
                svg.selectAll("*").remove();
                selectedElement = undefined;

                // get text from the letter
                letterText = xml.querySelector("TEXT").textContent
                admissionDate = new Date(letterText.split("\n")[2]);
                dischargeDate = new Date(letterText.split("\n")[4]);

                // parse all data
                let data = [].map.call(xml.querySelectorAll("EVENT"), function(event) {
                    let lowerBoundEndValue = new Date(event.getAttribute("lowerbound-end"));
                    let mostLikelyStartValue = new Date(event.getAttribute("most-likely-start"));
                    let mostLikelyEndValue = new Date(event.getAttribute("most-likely-end"));
                    let upperBoundStartValue = new Date(event.getAttribute("upperbound-start"));

                    if (lowerBoundEndValue < mostLikelyStartValue) lowerBoundEndValue = mostLikelyStartValue;
                    if (upperBoundStartValue > mostLikelyEndValue) upperBoundStartValue = mostLikelyEndValue;
                    return {
                        mostLikelyStart: mostLikelyStartValue,
                        mostLikelyEnd: mostLikelyEndValue,
                        lowerBoundStart: new Date(event.getAttribute("lowerbound-start")),
                        lowerBoundEnd: lowerBoundEndValue,
                        upperBoundStart: upperBoundStartValue,
                        upperBoundEnd: new Date(event.getAttribute("upperbound-end")),
                        label: event.getAttribute("text"),
                        type: event.getAttribute("type"),
                        id: event.getAttribute("text").replace(/[\W_\d]/g, ""),
                        polarity: event.getAttribute("polarity")
                    };
                });

                data = data.filter(d => d.polarity === "POS");

                const minDate = _.min(data.map(d => d.lowerBoundStart));
                const maxDate = _.max(data.map(d => d.upperBoundEnd));

                // todo: doubles are filtered in this version
                data = _.unique(data, "label");

                // group event by time and then type
                data = _.sortBy(_.sortBy(data, d => d.mostLikelyStart), j => j.type);

                crossData = crossfilter(data);
                crossData.onChange(() => {
                    if (selectedElement && !preventUpdate) draw(false);
                })
                let dataByType = crossData.dimension(d => d.type)

                // preserve filters when new document is selected
                data = dataByType.filter(d => {
                    return _.contains(filter, d)
                }).top(Infinity);

                /*
                 create and populate textview
                */

                // create spans for every event
                data.forEach(d => {
                    letterText = letterText.replace(d.label,
                        "<span class=label id=" + d.id + ">" + d.label + "</span>"
                    );
                });



                letterText = letterText.replace(/\s\./g, ".");
                letterText = letterText.replace(/\s\,/g, ",");

                // split report on hpi and hospital course
                splittedHPI = letterText.split(/history of present illness :|hpi :|history of present illness /i);
                splittedHC = splittedHPI[1].split(/hospital course :|Brief Hospital Course :|hospital course /i);

                // populate the corresponding views
                $("#letterbox").on("mouseup", () => {
                    openModal(window.getSelection().toString());
                })
                $("#admissiondatep")
                    .html(formatTime(admissionDate));
                $("#admissionLabel")
                    .mouseover(() => {
                        d3.select("#admissionLabel")
                            .transition(antiFlickerDuration / 2)
                            .style('background-color', "grey")
                            .style("color", "white");
                        d3.selectAll(".admissionDate")
                            .transition(antiFlickerDuration)
                            .style("stroke-width", 5)
                    })
                    .mouseout(() => {
                        d3.select("#admissionLabel")
                            .transition(antiFlickerDuration / 2)
                            .style('background-color', "transparent")
                            .style("color", "black");
                        d3.selectAll(".admissionDate")
                            .transition(antiFlickerDuration)
                            .style("stroke-width", 2)
                    })
                $("#dischargedatep")
                    .html(formatTime(dischargeDate));
                $("#dischargeLabel")
                    .mouseover(() => {
                        d3.select("#dischargeLabel")
                            .transition(antiFlickerDuration / 2)
                            .style('background-color', "grey")
                            .style("color", "white");
                        d3.selectAll(".dischargeDate")
                            .transition(antiFlickerDuration)
                            .style("stroke-width", 5)
                    })
                    .mouseout(() => {
                        d3.select("#dischargeLabel")
                            .transition(antiFlickerDuration / 2)
                            .style('background-color', "transparent")
                            .style("color", "black");
                        d3.selectAll(".dischargeDate")
                            .transition(antiFlickerDuration)
                            .style("stroke-width", 2)
                    })
                $("#hpip").html(splittedHC[0]);
                $("#hospitalcoursep").html(splittedHC[1]);

                $("#treatments_box").change(() => {
                    filter = _.reject(filter, d => d == "TREATMENT");
                    if (!$("#treatments_box").prop('checked')) {
                        dataByType.filter(d => {
                            return _.contains(filter, d)
                        });
                    } else {
                        filter.push("TREATMENT");
                        dataByType.filter((d => {
                            return _.contains(filter, d)
                        }));
                    }
                    draw(false);
                })
                $("#treatments_label").css("color", color("TREATMENT"))
                $("#treatments_checkmark").css("background-color", color("TREATMENT"))
                $("#occurrence_label").css("color", color("OCCURRENCE"))
                $("#occurrence_checkmark").css("background-color", color("OCCURRENCE"))
                $("#clinical_dept_label").css("color", color("CLINICAL_DEPT"))
                $("#clinical_dept_checkmark").css("background-color", color("CLINICAL_DEPT"))
                $("#test_label").css("color", color("TEST"))
                $("#test_checkmark").css("background-color", color("TEST"))
                $("#evidential_label").css("color", color("EVIDENTIAL"))
                $("#evidential_checkmark").css("background-color", color("EVIDENTIAL"))
                $("#problem_label").css("color", color("PROBLEM"))
                $("#problem_checkmark").css("background-color", color("PROBLEM"))
                $("#treatment_count").css("color", color("TREATMENT"));
                $("#test_count").css("color", color("TEST"));
                $("#problem_count").css("color", color("PROBLEM"));
                $("#occurrence_count").css("color", color("OCCURRENCE"));
                $("#evidential_count").css("color", color("EVIDENTIAL"));
                $("#clinical_dept_count").css("color", color("CLINICAL_DEPT"));

                $("#occurrence_box").change(() => {
                    filter = _.reject(filter, d => d == "OCCURRENCE");
                    if (!$("#occurrence_box").prop('checked')) {
                        dataByType.filter(d => {
                            return _.contains(filter, d)
                        });
                    } else {
                        filter.push("OCCURRENCE");
                        dataByType.filter((d => {
                            return _.contains(filter, d)
                        }));
                    }
                    draw(false);
                })

                $("#clinical_dept_box").change(() => {
                    filter = _.reject(filter, d => d == "CLINICAL_DEPT");
                    if (!$("#clinical_dept_box").prop('checked')) {
                        dataByType.filter(d => {
                            return _.contains(filter, d)
                        });
                    } else {
                        filter.push("CLINICAL_DEPT");
                        dataByType.filter((d => {
                            return _.contains(filter, d)
                        }));
                    }
                    draw(false);
                })

                $("#test_box").change(() => {
                    filter = _.reject(filter, d => d == "TEST");
                    if (!$("#test_box").prop('checked')) {
                        dataByType.filter(d => {
                            return _.contains(filter, d)
                        });
                    } else {
                        filter.push("TEST");
                        dataByType.filter((d => {
                            return _.contains(filter, d)
                        }));
                    }
                    draw(false);
                })

                $("#evidential_box").change(() => {
                    filter = _.reject(filter, d => d == "EVIDENTIAL");
                    if (!$("#evidential_box").prop('checked')) {
                        dataByType.filter(d => {
                            return _.contains(filter, d)
                        });
                    } else {
                        filter.push("EVIDENTIAL");
                        dataByType.filter((d => {
                            return _.contains(filter, d)
                        }));
                    }
                    draw(false);
                })

                $("#problem_box").change(() => {
                    filter = _.reject(filter, d => d == "PROBLEM");
                    if (!$("#problem_box").prop('checked')) {
                        dataByType.filter(d => {
                            return _.contains(filter, d)
                        });
                    } else {
                        filter.push("PROBLEM");
                        dataByType.filter((d => {
                            return _.contains(filter, d)
                        }));
                    }
                    draw(false);
                })

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
                        // markWords(d, color)
                        select_axis_label(d.label)
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
                let yAxis = svg.append("g")
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
                    .on("end", (start, end) => {
                        updateChart(start, end)
                    }) // Each time the brush selection changes, trigger the 'updateChart' function

                var scatter = svg.append('g')
                    .attr("clip-path", "url(#clip)")

                // Add the brushing before the elements (for mouseover)
                scatter
                    .append("g")
                    .attr("class", "brush")
                    .call(brush);

                draw(true);

                function draw(first) {
                    d3.selectAll(".label").style("background", "transparent")
                        // Create the scatter variable: where both the circles and the brush take place
                    let sortedData = _.sortBy(_.sortBy(dataByType.top(Infinity), d => -d.mostLikelyStart), j => j.type);

                    $("#treatment_count").html(" (" + getCount("TREATMENT") + ")");
                    $("#test_count").html(" (" + getCount("TEST") + ")");
                    $("#problem_count").html(" (" + getCount("PROBLEM") + ")");
                    $("#occurrence_count").html(" (" + getCount("OCCURRENCE") + ")");
                    $("#evidential_count").html(" (" + getCount("EVIDENTIAL") + ")");
                    $("#clinical_dept_count").html(" (" + getCount("CLINICAL_DEPT") + ")");

                    function getCount(type) {
                        let groups = dataByType.group().top(Infinity);
                        let keyValue = _.findWhere(groups, { key: type });
                        if (keyValue) {
                            return keyValue.value;
                        } else {
                            return 0;
                        }
                    }

                    let hpipLabels = d3.select("#letterbox")
                        .selectAll(".label")
                        .data(sortedData, function(d) {
                            return (d && d.id) || d3.select(this).attr("id");
                        })

                    hpipLabels
                        .style("background", d => rgbaColor(d))
                        .on("mouseover", (d) => {
                            if (_.contains(filter, d.type))
                                highlightMaster(d.id, color(d.type));
                        })
                        .on("mouseout", (d) => {
                            if (_.contains(filter, d.type))
                                unhighlightMaster(d.id, color(d.type), d.label)
                        })
                        .on("click", (d) => {
                            if (_.contains(filter, d.type))
                                openModal(d)
                        })

                    y.domain(sortedData.map(d => d.label))

                    // Update axis and circle position
                    yAxis.transition().duration(defaultDuration).call(d3.axisLeft(y))

                    // data = _.sortBy(_.sortBy(data, d => d.mostLikelyStart), j => j.type);

                    let mostlikelyBars = scatter.selectAll(".mostlikely")
                        .data(sortedData, d => d.id)

                    mostlikelyBars
                        .transition().duration(defaultDuration)
                        .attr("y", d => y(d.label))
                        .attr("height", y.bandwidth())
                        .attr("x", d => x(d.mostLikelyStart))
                        .attr("width", d => {
                            let returnWidth = Math.max(minRectWidth, x(d.mostLikelyEnd) - x(d.mostLikelyStart))
                            if (returnWidth >= 0) {
                                return returnWidth;
                            } else {
                                return 0;
                            }
                        });

                    mostlikelyBars
                        .enter()
                        .append("rect")
                        .attr("class", "mostlikely")
                        .attr("id", d => "mostlikely-" + d.id)
                        .attr("width", d => {
                            let returnWidth = Math.max(minRectWidth, x(d.mostLikelyEnd) - x(d.mostLikelyStart))
                            if (returnWidth >= 0) {
                                return returnWidth;
                            } else {
                                return 0;
                            }
                        })
                        .attr("height", y.bandwidth())
                        .attr("y", 0)
                        .attr("x", d => x(d.mostLikelyStart))
                        .style("fill", d => color(d.type))
                        .style("opacity", normalOpacity)
                        .on('mouseover', tip.show)
                        .on('mouseout', d => {
                            tip.hide()
                                // unMarkWords(d);
                            unhighlightMaster(d.id, color(d.type), d.label);
                        })
                        .on('click', (d) => {
                            selectedElement = d;
                            openModal(d);
                        })
                        .transition().duration(defaultDuration)
                        .attr("y", d => y(d.label));

                    mostlikelyBars.exit()
                        .transition().duration(defaultDuration)
                        .attr("y", mainWidgetHeight)
                        .remove()

                    let lowerUncertaintyBars = scatter.selectAll(".lower_uncertainty")
                        .data(sortedData, d => d.id)

                    lowerUncertaintyBars
                        .transition().duration(defaultDuration)
                        .attr("y", d => y(d.label))
                        .attr("height", y.bandwidth())
                        .attr("x", d => x(d.lowerBoundStart))
                        .attr("width", d => {
                            let returnWidth = x(d.lowerBoundEnd) - x(d.lowerBoundStart)
                            if (returnWidth >= 0) {
                                return returnWidth;
                            } else {
                                return 0;
                            }
                        });

                    lowerUncertaintyBars
                        .enter()
                        .append("rect")
                        .attr("class", "lower_uncertainty")
                        .attr("id", d => "lower_uncertainty-" + d.id)
                        .attr("width", d => {
                            let returnWidth = x(d.lowerBoundEnd) - x(d.lowerBoundStart)
                            if (returnWidth >= 0) {
                                return returnWidth;
                            } else {
                                return 0;
                            }
                        })
                        .attr("height", y.bandwidth())
                        .attr("y", 0)
                        .attr("x", d => x(d.lowerBoundStart))
                        .style("fill", d => color(d.type))
                        .style("opacity", normalUncertaintyOpacity)
                        .on('mouseover', tip.show)
                        .on('mouseout', d => {
                            tip.hide()
                                // unMarkWords(d);
                            unhighlightMaster(d.id, color(d.type), d.label);
                        })
                        .on('click', (d) => {
                            selectedElement = d;
                            openModal(d);
                        })
                        .transition().duration(defaultDuration)
                        .attr("y", d => y(d.label));

                    lowerUncertaintyBars.exit()
                        .transition().duration(defaultDuration)
                        .attr("y", mainWidgetHeight)
                        .remove();

                    let upperUncertaintyBars = scatter.selectAll(".upper_uncertainty")
                        .data(sortedData, d => d.id)

                    upperUncertaintyBars
                        .transition().duration(defaultDuration)
                        .attr("y", d => y(d.label))
                        .attr("height", y.bandwidth())
                        .attr("x", d => x(d.upperBoundStart))
                        .attr("width", d => {
                            let returnWidth = x(d.upperBoundEnd) - x(d.upperBoundStart)
                            if (returnWidth >= 0) {
                                return returnWidth;
                            } else {
                                return 0;
                            }
                        })

                    upperUncertaintyBars
                        .enter()
                        .append("rect")
                        .attr("class", d => "upper_uncertainty")
                        .attr("id", d => "upper_uncertainty-" + d.id)
                        .attr("width", d => {
                            let returnWidth = x(d.upperBoundEnd) - x(d.upperBoundStart)
                            if (returnWidth >= 0) {
                                return returnWidth;
                            } else {
                                return 0;
                            }
                        })
                        .attr("height", y.bandwidth())
                        .attr("y", 0)
                        .attr("x", d => x(d.upperBoundStart))
                        .style("fill", d => color(d.type))
                        .style("opacity", normalUncertaintyOpacity)
                        .on('mouseover', tip.show)
                        .on('mouseout', d => {
                            tip.hide()
                                // unMarkWords(d);
                            unhighlightMaster(d.id, color(d.type), d.label);
                        })
                        .on('click', (d) => {
                            selectedElement = d;
                            openModal(d);
                        })
                        .transition().duration(defaultDuration)
                        .attr("y", d => y(d.label));

                    upperUncertaintyBars.exit()
                        .transition().duration(defaultDuration)
                        .attr("y", mainWidgetHeight)
                        .remove();

                    scatter
                        .append("line")
                        .attr("class", "admissionDate")
                        .attr("x1", x(admissionDate))
                        .attr("x2", x(admissionDate))
                        .attr("y1", 0)
                        .attr("y2", mainWidgetHeight)
                        .style("stroke-width", 2)
                        .style("stroke", "darkgrey")
                        .style("fill", "none")
                        .on('mouseover', (d, i, n) => {
                            d3.select(n[i])
                                .transition(antiFlickerDuration / 2)
                                .style("stroke-width", 5)
                            d3.select("#admissionLabel")
                                .transition(antiFlickerDuration / 2)
                                .style('background-color', "grey")
                                .style("color", "white");
                        })
                        .on('mouseout', (d, i, n) => {
                            d3.select(n[i])
                                .transition(antiFlickerDuration / 2)
                                .style("stroke-width", 2)
                            d3.select("#admissionLabel")
                                .transition(antiFlickerDuration / 2)
                                .style('background-color', "transparent")
                                .style("color", "black");
                        })

                    scatter
                        .append("line")
                        .attr("class", "dischargeDate")
                        .attr("x1", x(dischargeDate))
                        .attr("x2", x(dischargeDate))
                        .attr("y1", 0)
                        .attr("y2", mainWidgetHeight)
                        .style("stroke-width", 2)
                        .style("stroke", "darkgrey")
                        .style("fill", "none")
                        .on('mouseover', (d, i, n) => {
                            d3.select(n[i])
                                .transition(antiFlickerDuration / 2)
                                .style("stroke-width", 5)
                            d3.select("#dischargeLabel")
                                .transition(antiFlickerDuration / 2)
                                .style('background-color', "grey")
                                .style("color", "white");
                        })
                        .on('mouseout', (d, i, n) => {
                            d3.select(n[i])
                                .transition(antiFlickerDuration / 2)
                                .style("stroke-width", 2)
                            d3.select("#dischargeLabel")
                                .transition(antiFlickerDuration / 2)
                                .style('background-color', "transparent")
                                .style("color", "black");
                        })


                    // zoom in to mostlikely range
                    minLikelyDate = _.min(data.map(d => d.mostLikelyStart));
                    maxLikelyDate = _.max(data.map(d => d.mostLikelyEnd));
                    if (first) updateChart(x(new Date(admissionDate.getTime() - (24 * 60 * 60 * 1000) * daysOffsetForZoom)), x(new Date(dischargeDate.getTime() + (24 * 60 * 60 * 1000) * daysOffsetForZoom)));

                }
                // A function that set idleTimeOut to null
                var idleTimeout // var because used in idled()
                function idled() { idleTimeout = null; }
                // A function that update the chart for given boundaries

                function updateChart(startX, endX) {

                    let duration = defaultDuration;
                    let delay = defaultDelay;

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
                        .attr("width", d => x(d.lowerBoundEnd) - x(d.lowerBoundStart))
                        .attr("x", d => x(d.lowerBoundStart))

                    scatter
                        .selectAll(".upper_uncertainty")
                        .transition().delay(delay).duration(duration)
                        .attr("width", d => x(d.upperBoundEnd) - x(d.upperBoundStart))
                        .attr("x", d => x(d.upperBoundStart))

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
        }
    });


});

function openModal(d) {
    if (d.id) {
        selectedElement = d;
        d3.select("#modal-1-title").text(d.label);
        $("#modal_start_date").val(d.mostLikelyStart.toISOString().substring(0, 19));
        $("#modal_end_date").val(d.mostLikelyEnd.toISOString().substring(0, 19));
        MicroModal.show('modal-1');
    } else {
        if (d) {
            $("#modal_type_span").css("display", "inline-block")
            $("#modal_type").show()
            d3.select("#modal-1-title").text(d);
            $("#modal_start_date").val(admissionDate.toISOString().substring(0, 19));
            $("#modal_end_date").val(dischargeDate.toISOString().substring(0, 19));
            MicroModal.show('modal-1');
            selectedElement = "CREATE_NEW";
        }
    }

}

function rgbaColor(d) {
    bgRGB = d3.color(color(d.type));
    return "rgba(" + bgRGB.r + "," + bgRGB.g + "," + bgRGB.b + "," + textOpacity + ")";
}

function unhighlightMaster(id, color, label) {
    select_axis_label(label)
        .transition(antiFlickerDuration)
        .style("fill", "black")
        .style("font-weight", "normal")
        .style("font-size", "10px")
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
            return z.replace(/[\W_\d]/g, "") == id;
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
            return z.replace(/[\W_\d]/g, "") == id;
        })
        .transition(antiFlickerDuration)
        .style("fill", color)
        .style("font-weight", "bold")
        .style("font-size", "20px")
}

function select_axis_label(label) {
    return d3.select('.axis--y')
        .selectAll('text')
        .filter(function(x) { return x == label; });
}

function removeEvent(selectedId) {
    if (!selectedId) selectedId = selectedElement.id;
    $("#" + selectedId).removeAttr("id") //hack, with no ID, no background or listener
    MicroModal.close("modal-1");
    crossData.remove(d => d.id === selectedId);
}

function saveEvent(selectedId) {
    if (selectedElement == "CREATE_NEW") {
        let newLabel = window.getSelection().toString();
        let newEvent = {
            mostLikelyStart: new Date($("#modal_start_date").val()),
            mostLikelyEnd: new Date($("#modal_end_date").val()),
            lowerBoundStart: new Date($("#modal_start_date").val()),
            lowerBoundEnd: new Date($("#modal_end_date").val()),
            upperBoundStart: new Date($("#modal_start_date").val()),
            upperBoundEnd: new Date($("#modal_end_date").val()),
            label: newLabel,
            type: $("#modal_type").val(),
            id: newLabel.replace(/[\W_\d]/g, ""),
            polarity: "POS"
        };

        $("#hpip").html($("#hpip").html().replace(newLabel,
            "<span class=label id=" + newEvent.id + ">" + newEvent.label + "</span>"
        ));
        $("#hospitalcoursep").html($("#hospitalcoursep").html().replace(newLabel,
            "<span class=label id=" + newEvent.id + ">" + newEvent.label + "</span>"
        ));

        crossData.add([newEvent])

        MicroModal.close("modal-1");
        $("#modal_type_span").hide()
        $("#modal_type").hide()

    } else {
        if (!selectedId) selectedId = selectedElement.id;

        selectedElement.mostLikelyStart = new Date($("#modal_start_date").val());
        selectedElement.mostLikelyEnd = new Date($("#modal_end_date").val());
        if (selectedElement.mostLikelyEnd < selectedElement.mostLikelyStart) {
            window.alert("The end date should be later than the start date.")
        } else {
            preventUpdate = true; // prevent onchange listener to start animations
            crossData.remove(d => d.id === selectedId);
            preventUpdate = false;
            crossData.add([selectedElement])

            MicroModal.close("modal-1");
        }
    }
}