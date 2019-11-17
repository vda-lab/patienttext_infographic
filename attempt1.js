// set the dimensions and margins of the graph
const margin = { top: 20, right: 20, bottom: 100, left: 200 },
    width = window.innerWidth - margin.left - margin.right,
    height = 3000 - margin.top - margin.bottom;

const eventHeight = 5;

const svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

var tip = d3.tip()
    .attr("class", "d3-tip")
    .offset([-8, 0])
    .html(d => "<strong>" + d.mostLikelyStart.toLocaleDateString('nl') + ": " + "</strong> <span style='color:red'>" + d.label + "</span>");
svg.call(tip);

var gTime = d3
    .select('div#slider-time')
    .append('svg')
    .attr('width', width)
    .attr('height', 100)
    .append('g')
    .attr('transform', 'translate(200,30)');

const x = d3.scaleTime()
    // .domain([minDate, maxDate])
    .range([0, width]);

const y = d3.scaleLinear()
    // .domain([0, data.length])
    .range([height, 0]);

load();

function load() {
    d3.csv("firstcsv.csv", d => {
        return {
            mostLikelyStart: new Date(d._mostlikelystart),
            mostLikelyEnd: new Date(d._mostlikelyend),
            lowerBoundStart: new Date(d._lowerboundstart),
            lowerBoundEnd: new Date(d._lowerboundend),
            upperBoundStart: new Date(d._upperboundstart),
            upperBoundEnd: new Date(d._upperboundend),
            label: d._text,
            type: d._type
        };
    }).then(data => {
        const bandHeight = height / data.length

        minDate = _.min(data.map(d => d.lowerBoundStart));
        maxDate = _.max(data.map(d => d.upperBoundEnd));

        var sliderTime = d3
            .sliderBottom()
            .min(minDate)
            .max(maxDate)
            .step(1000 * 60 * 60 * 24 * 365)
            .width(width - 200)
            .tickFormat(d3.timeFormat("%Y-%m-%d"))
            // .tickValues(dataTime)
            .default([new Date(1998, 10, 3), new Date(2020, 10, 3)]) // set day to today!
            .fill('#2196f3')
            .on('onchange', val => {
                console.log(val);
                // d3.select('p#value-time').text(d3.timeFormat('%Y')(val));
                update(val)
            });

        gTime.call(sliderTime);

        // d3.select('p#value-time').text(d3.timeFormat('%Y')(sliderTime.value()));

        update();

        function update(setDates) {

            minSetDate = setDates == undefined ? minDate : setDates[0];
            maxSetDate = setDates == undefined ? maxDate : setDates[1];

            x.domain([minDate, maxDate])
            y.domain([0, data.length]);

        }




        // Gridline
        const horGridLines = d3.axisLeft()
            .tickFormat("")
            .ticks(data.length)
            .tickSize(-height)
            .scale(y);

        const verGridLines = d3.axisTop()
            .tickFormat("")
            .tickSize(-height)
            .scale(x);

        svg.append("g")
            .attr("class", "horgrid")
            .call(horGridLines);

        svg.append("g")
            .attr("class", "vergrid")
            .call(verGridLines);

        // // Add the X Axis
        d3.select("#floatx").append("g")
            .attr("class", "axis")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
            .call(d3.axisBottom(x)
                .tickFormat(d3.timeFormat("%Y-%m-%d"))
                .scale(x))
            .selectAll("text")
            .attr("dy", "-1em")

        // JOIN new data with old elements.
        var rect = svg.selectAll("rect")
            .data(data);

        // ENTER new elements present in new data.
        rect.enter().append("rect")
            .attr("class", d => "mostlikely " + d.label)
            .attr("width", d => x(d.mostLikelyEnd) - x(d.mostLikelyStart))
            .attr("height", eventHeight)
            .attr("y", (d, i) => y(i) - bandHeight / 2 - eventHeight / 2)
            .attr("x", d => x(d.mostLikelyStart))
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);

        // ENTER new elements present in new data.
        rect.enter().append("rect")
            .attr("class", "lowerbound")
            .attr("width", d => x(d.lowerBoundEnd) - x(d.lowerBoundStart))
            .attr("height", eventHeight)
            .attr("y", (d, i) => y(i) - bandHeight / 2 - eventHeight / 2)
            .attr("x", d => x(d.lowerBoundStart))
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);

        rect.enter().append("rect")
            .attr("class", "upperbound")
            .attr("width", d => x(d.upperBoundEnd) - x(d.upperBoundStart))
            .attr("height", eventHeight)
            .attr("y", (d, i) => y(i) - bandHeight / 2 - eventHeight / 2)
            .attr("x", d => x(d.upperBoundStart))
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);

        var labels = svg.selectAll("text label")
            .data(data);

        labels.enter().append("text")
            .attr("class", d => "label-" + d.type.toLowerCase())
            .attr("y", (d, i) => y(i) - bandHeight / 3)
            .attr("x", -margin.left + 5)
            .text(d => d.label)
    });
}


function zoomed() {
    var t = d3.event.transform,
        xt = t.rescaleX(x);
    g.select(".area").attr("d", area.x(function(d) { return xt(d.date); }));
    g.select(".axis--x").call(xAxis.scale(xt));
}